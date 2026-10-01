-- Creator package wallet + balance-based campaign creation.
-- Package purchase credits are intended to be called only after a verified payment success
-- (e.g. Razorpay webhook/server). Do NOT expose a public crediting RPC to clients.

create table if not exists public.creator_package_wallets (
  creator_id uuid primary key references public.profiles(id) on delete cascade,
  available_views integer not null default 0 check (available_views >= 0),
  available_watch_minutes numeric(18,2) not null default 0 check (available_watch_minutes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_package_purchases (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.campaign_packages(id) on delete restrict,
  package_name text not null,
  price_rupees numeric(18,2) not null check (price_rupees >= 0),
  views_credited integer not null check (views_credited > 0),
  watch_minutes_credited numeric(18,2) not null check (watch_minutes_credited > 0),
  payment_reference text,
  status text not null default 'paid' check (status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default now()
);

alter table public.creator_package_wallets enable row level security;
alter table public.creator_package_purchases enable row level security;

drop policy if exists creator_package_wallets_read_self on public.creator_package_wallets;
create policy creator_package_wallets_read_self on public.creator_package_wallets
for select to authenticated using (creator_id = auth.uid() or public.is_admin());

drop policy if exists creator_package_purchases_read_self on public.creator_package_purchases;
create policy creator_package_purchases_read_self on public.creator_package_purchases
for select to authenticated using (creator_id = auth.uid() or public.is_admin());

-- Server/admin-only credit operation. A payment webhook or trusted server should call this
-- after payment verification. It intentionally cannot be called by normal authenticated users.
drop function if exists public.credit_creator_package(uuid,uuid,text);
create or replace function public.credit_creator_package(
  p_creator_id uuid,
  p_package_id uuid,
  p_payment_reference text default null
)
returns public.creator_package_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.campaign_packages%rowtype;
  r public.creator_package_purchases%rowtype;
begin
  if not public.is_admin() then raise exception 'Only admin can credit a package purchase'; end if;
  select * into p from public.campaign_packages where id=p_package_id and active=true;
  if not found then raise exception 'Package not found or inactive'; end if;

  insert into public.creator_package_wallets(creator_id,available_views,available_watch_minutes)
  values(p_creator_id,p.target_views,p.total_watch_minutes)
  on conflict(creator_id) do update set
    available_views = public.creator_package_wallets.available_views + excluded.available_views,
    available_watch_minutes = public.creator_package_wallets.available_watch_minutes + excluded.available_watch_minutes,
    updated_at = now();

  insert into public.creator_package_purchases(creator_id,package_id,package_name,price_rupees,views_credited,watch_minutes_credited,payment_reference,status)
  values(p_creator_id,p.id,p.name,p.price_rupees,p.target_views,p.total_watch_minutes,p_payment_reference,'paid')
  returning * into r;
  return r;
end;
$$;
revoke all on function public.credit_creator_package(uuid,uuid,text) from public;
grant execute on function public.credit_creator_package(uuid,uuid,text) to authenticated;

-- Campaigns now consume only the creator's purchased package balance.
drop function if exists public.create_campaign_from_package_balance(text,uuid,uuid,text,text,integer,numeric);
create or replace function public.create_campaign_from_package_balance(
  p_creation_request_id text,
  p_creator_id uuid,
  p_content_id uuid,
  p_title text,
  p_type text,
  p_target_views integer,
  p_watch_minutes numeric
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.campaigns%rowtype;
  existing public.campaigns%rowtype;
  w public.creator_package_wallets%rowtype;
  required_seconds integer;
  creator_role text;
  creator_account_type text;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then raise exception 'Unauthorized'; end if;
  if p_target_views < 1 then raise exception 'Enter at least 1 view'; end if;
  if p_watch_minutes <= 0 then raise exception 'Enter a valid watch-time requirement'; end if;
  select role, account_type into creator_role, creator_account_type from public.profiles where id=p_creator_id;
  if coalesce(creator_role,'') not in ('admin','creator') and coalesce(creator_account_type,'') <> 'promotion' then raise exception 'Only creator/promotion accounts can create campaigns'; end if;
  if p_type not in ('video','shorts','live') then raise exception 'Invalid campaign type'; end if;

  select * into existing from public.campaigns where creation_request_id=p_creation_request_id limit 1;
  if found then return existing; end if;

  select * into w from public.creator_package_wallets where creator_id=p_creator_id for update;
  if not found then raise exception 'No package balance available. Buy a campaign package first.'; end if;
  if w.available_views < p_target_views then raise exception 'Insufficient package view balance. Available: % views', w.available_views; end if;
  if w.available_watch_minutes < p_watch_minutes then raise exception 'Insufficient package watch-time balance. Available: % minutes', w.available_watch_minutes; end if;

  required_seconds := greatest(1, ceil((p_watch_minutes * 60.0 / p_target_views)))::integer;
  if p_type='shorts' and required_seconds >= 60 then raise exception 'This campaign requires 60 seconds or more per Short view and cannot be used for Shorts'; end if;

  update public.creator_package_wallets
  set available_views=available_views-p_target_views,
      available_watch_minutes=available_watch_minutes-p_watch_minutes,
      updated_at=now()
  where creator_id=p_creator_id;

  insert into public.campaigns(
    creator_id,content_id,title,type,target_views,required_watch_seconds,creation_request_id,
    package_id,package_name,package_price,total_watch_minutes
  ) values (
    p_creator_id,p_content_id,p_title,p_type,p_target_views,required_seconds,p_creation_request_id,
    null,'Package Balance',0,p_watch_minutes
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.create_campaign_from_package_balance(text,uuid,uuid,text,text,integer,numeric) from public;
grant execute on function public.create_campaign_from_package_balance(text,uuid,uuid,text,text,integer,numeric) to authenticated;

-- The previous package-only creator RPC is retired; campaigns must consume purchased balance.
drop function if exists public.create_campaign_with_package(text,uuid,uuid,text,text,uuid);
