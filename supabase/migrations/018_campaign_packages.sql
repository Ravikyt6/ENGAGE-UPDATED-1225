-- Package-based creator campaigns.
-- Package controls target views and total watch time; creators do not enter these manually.

create table if not exists public.campaign_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_rupees numeric(18,2) not null check (price_rupees > 0),
  target_views integer not null check (target_views > 0),
  total_watch_minutes numeric(18,2) not null check (total_watch_minutes > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns
  add column if not exists package_id uuid references public.campaign_packages(id) on delete restrict,
  add column if not exists package_name text,
  add column if not exists package_price numeric(18,2),
  add column if not exists total_watch_minutes numeric(18,2);

alter table public.campaign_packages enable row level security;
drop policy if exists campaign_packages_read_active on public.campaign_packages;
create policy campaign_packages_read_active on public.campaign_packages
  for select to authenticated using (active = true or public.is_admin());
drop policy if exists campaign_packages_admin_insert on public.campaign_packages;
create policy campaign_packages_admin_insert on public.campaign_packages
  for insert to authenticated with check (public.is_admin());
drop policy if exists campaign_packages_admin_update on public.campaign_packages;
create policy campaign_packages_admin_update on public.campaign_packages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists campaign_packages_admin_delete on public.campaign_packages;
create policy campaign_packages_admin_delete on public.campaign_packages
  for delete to authenticated using (public.is_admin());

insert into public.campaign_packages(slug,name,price_rupees,target_views,total_watch_minutes,sort_order,active)
select * from (values
  ('starter','Starter',99,100,60,0,true),
  ('basic','Basic',199,250,150,1,true),
  ('growth','Growth',399,500,300,2,true),
  ('standard','Standard',699,1000,600,3,true),
  ('pro','Pro',1499,2500,1500,4,true),
  ('premium','Premium',2499,5000,3000,5,true),
  ('business','Business',3499,10000,6000,6,true)
) as v(slug,name,price_rupees,target_views,total_watch_minutes,sort_order,active)
where not exists (select 1 from public.campaign_packages p where p.slug=v.slug);

-- New package-based campaign creation. The package is authoritative for views/time/price.
drop function if exists public.create_campaign_with_package(text,uuid,uuid,text,text,uuid);
create or replace function public.create_campaign_with_package(
  p_creation_request_id text,
  p_creator_id uuid,
  p_content_id uuid,
  p_title text,
  p_type text,
  p_package_id uuid
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.campaigns%rowtype;
  existing public.campaigns%rowtype;
  p public.campaign_packages%rowtype;
  required_seconds integer;
  creator_role text;
  creator_account_type text;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then raise exception 'Unauthorized'; end if;
  select role, account_type into creator_role, creator_account_type from public.profiles where id=p_creator_id;
  if coalesce(creator_role,'') not in ('admin','creator') and coalesce(creator_account_type,'') <> 'promotion' then
    raise exception 'Only creator/promotion accounts can create campaigns';
  end if;
  if p_type not in ('video','shorts','live') then raise exception 'Invalid campaign type'; end if;

  select * into p from public.campaign_packages where id=p_package_id and active=true;
  if not found then raise exception 'Selected campaign package is unavailable'; end if;

  required_seconds := greatest(30, ceil((p.total_watch_minutes * 60.0 / p.target_views) / 30.0) * 30)::integer;
  if p_type='shorts' and required_seconds >= 60 then
    raise exception 'This package requires 60 seconds or more per Short view and cannot be used for Shorts';
  end if;

  select * into existing from public.campaigns where creation_request_id=p_creation_request_id limit 1;
  if found then return existing; end if;

  insert into public.campaigns(
    creator_id,content_id,title,type,target_views,required_watch_seconds,creation_request_id,
    package_id,package_name,package_price,total_watch_minutes
  ) values (
    p_creator_id,p_content_id,p_title,p_type,p.target_views,required_seconds,p_creation_request_id,
    p.id,p.name,p.price_rupees,p.total_watch_minutes
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.create_campaign_with_package(text,uuid,uuid,text,text,uuid) from public;
grant execute on function public.create_campaign_with_package(text,uuid,uuid,text,text,uuid) to authenticated;
