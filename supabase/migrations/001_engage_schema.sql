-- ENGAGE production schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null default 'User',
  role text not null default 'user'
    check (role in ('admin','user','creator')),
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins numeric(18,4) not null default 0,
  earnings numeric(18,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('video','shorts','live')),
  title text not null,
  creator_name text not null default 'Creator',
  youtube_url text not null,
  youtube_video_id text not null,
  duration_seconds integer not null default 0,
  views integer not null default 0,
  status text not null default 'active'
    check (status in ('active','live','offline')),
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid references public.contents(id) on delete set null,
  title text not null,
  type text not null check (type in ('video','shorts','live')),
  target_views integer not null check (target_views > 0),
  required_watch_seconds integer not null check (required_watch_seconds > 0),
  coin_reward_per_user numeric(18,4) not null default 0,
  dollar_reward_per_user numeric(18,4) not null default 0,
  creation_cost numeric(18,4) not null default 0,
  current_views integer not null default 0,
  qualified_users integer not null default 0,
  coins_paid numeric(18,4) not null default 0,
  dollars_paid numeric(18,4) not null default 0,
  creation_request_id text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_qualifications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  watch_seconds integer not null default 0,
  coins_awarded numeric(18,4) not null default 0,
  dollars_awarded numeric(18,4) not null default 0,
  qualified_at timestamptz not null default now(),
  unique(campaign_id,user_id)
);

create table if not exists public.app_settings (
  id integer primary key default 1,
  reward_per_user numeric(18,4) not null default 0.10,
  campaign_creation_cost numeric(18,4) not null default 500,
  autoplay_enabled boolean not null default true,
  ad_enabled boolean not null default false,
  social_bar_enabled boolean not null default false,
  monetag_multitag_enabled boolean not null default false,
  monetag_vignette_enabled boolean not null default false,
  monetag_push_created_enabled boolean not null default false,
  monetag_in_page_push_enabled boolean not null default false,
  ad_interval_seconds integer not null default 15,
  show_ad_on_end boolean not null default false,
  min_short_seconds integer not null default 1,
  max_short_seconds integer not null default 59,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(id)
values (1)
on conflict (id) do nothing;

-- Campaign creation idempotency. This prevents a repeated client request
-- from charging the creator more than once.
alter table public.campaigns
  add column if not exists creation_request_id text;

alter table public.app_settings
  add column if not exists social_bar_enabled boolean not null default false;

create unique index if not exists campaigns_creation_request_id_uidx
on public.campaigns(creation_request_id)
where creation_request_id is not null;

-- Create profile + wallet for every new Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,email,name,role)
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name','User'),
    coalesce(new.raw_user_meta_data->>'role','user')
  )
  on conflict (id) do update
    set email=excluded.email,
        name=excluded.name;

  insert into public.wallets(user_id,coins,earnings)
  values(new.id,1000,0)
  on conflict(user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Admin check without recursive profiles policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.contents enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_qualifications enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self
on public.profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
on public.profiles for update
using (public.is_admin());

drop policy if exists wallets_self on public.wallets;
create policy wallets_self
on public.wallets for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists wallets_self_update on public.wallets;
create policy wallets_self_update
on public.wallets for update
using (user_id = auth.uid() or public.is_admin());

drop policy if exists contents_read on public.contents;
create policy contents_read
on public.contents for select
using (auth.uid() is not null);

drop policy if exists contents_owner_insert on public.contents;
create policy contents_owner_insert
on public.contents for insert
with check (creator_id = auth.uid() or public.is_admin());

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read
on public.campaigns for select
using (auth.uid() is not null);

drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert
on public.campaigns for insert
with check (creator_id = auth.uid() or public.is_admin());

drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update
on public.campaigns for update
using (creator_id = auth.uid() or public.is_admin());

drop policy if exists qualification_read on public.campaign_qualifications;
create policy qualification_read
on public.campaign_qualifications for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists settings_read on public.app_settings;
create policy settings_read
on public.app_settings for select
using (auth.uid() is not null);

drop policy if exists settings_admin_update on public.app_settings;
create policy settings_admin_update
on public.app_settings for update
using (public.is_admin());

-- IMPORTANT:
-- Reward/coin qualification should be performed by a SECURITY DEFINER
-- RPC in production, not trusted to the browser.


-- Authoritative campaign creation.
-- The browser sends only campaign inputs. Cost/reward are recalculated here
-- from the same economy: 30 sec = 5 coins/user and 15% internal margin.
drop function if exists public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer);

create or replace function public.create_campaign_with_cost(
  p_creation_request_id text,
  p_creator_id uuid,
  p_content_id uuid,
  p_title text,
  p_type text,
  p_target_views integer,
  p_required_watch_seconds integer
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.campaigns%rowtype;
  existing public.campaigns%rowtype;
  wallet_coins numeric;
  reward_per_user numeric;
  viewer_pool numeric;
  final_cost numeric;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then
    raise exception 'Unauthorized';
  end if;

  if coalesce(trim(p_creation_request_id), '') = '' then
    raise exception 'Creation request id is required';
  end if;

  if p_target_views is null or p_target_views <= 0 then
    raise exception 'Target users must be greater than 0';
  end if;

  if p_required_watch_seconds is null or p_required_watch_seconds < 30 then
    raise exception 'Required watch time must be at least 30 seconds';
  end if;

  if mod(p_required_watch_seconds, 30) <> 0 then
    raise exception 'Required watch time must use 30-second increments';
  end if;

  if p_type not in ('video','shorts','live') then
    raise exception 'Invalid campaign type';
  end if;

  if p_type = 'shorts' and p_required_watch_seconds >= 60 then
    raise exception 'Shorts watch requirement must be below 60 seconds';
  end if;

  select * into existing
  from public.campaigns
  where creation_request_id = p_creation_request_id
  limit 1;

  if found then
    if existing.creator_id <> p_creator_id then
      raise exception 'Invalid creation request';
    end if;
    return existing;
  end if;

  reward_per_user := (p_required_watch_seconds::numeric / 30) * 5;
  viewer_pool := p_target_views::numeric * reward_per_user;
  final_cost := ceil(viewer_pool * 1.15);

  select coins into wallet_coins
  from public.wallets
  where user_id = p_creator_id
  for update;

  if wallet_coins is null or wallet_coins < final_cost then
    raise exception 'Insufficient coins. % coins required.', final_cost::bigint;
  end if;

  insert into public.campaigns(
    creator_id, content_id, title, type, target_views,
    required_watch_seconds, coin_reward_per_user,
    dollar_reward_per_user, creation_cost, creation_request_id
  )
  values(
    p_creator_id, p_content_id, p_title, p_type, p_target_views,
    p_required_watch_seconds, reward_per_user,
    reward_per_user * 0.0002, final_cost, p_creation_request_id
  )
  returning * into result;

  update public.wallets
  set coins = coins - final_cost,
      updated_at = now()
  where user_id = p_creator_id;

  return result;
end;
$$;

revoke all on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) from public;
grant execute on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) to authenticated;

-- Legacy RPC kept for compatibility with older clients. It does not accept a
-- client-authoritative price; callers should migrate to create_campaign_with_cost.
drop function if exists public.spend_campaign_coins(uuid,uuid,numeric);

-- Secure one-view-one-reward qualification.
create or replace function public.qualify_campaign_view(
  p_campaign_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  select *
  into c
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found or c.status <> 'active' then
    return;
  end if;

  if c.creator_id = p_user_id then
    return;
  end if;

  if c.current_views >= c.target_views then
    update public.campaigns
    set status = 'completed'
    where id = c.id;
    return;
  end if;

  insert into public.campaign_qualifications(
    campaign_id,
    user_id,
    watch_seconds,
    coins_awarded,
    dollars_awarded
  )
  values(
    c.id,
    p_user_id,
    c.required_watch_seconds,
    c.coin_reward_per_user,
    c.dollar_reward_per_user
  )
  on conflict(campaign_id,user_id) do nothing;

  if found then
    update public.wallets
    set coins = coins + c.coin_reward_per_user,
        earnings = earnings + c.dollar_reward_per_user,
        updated_at = now()
    where user_id = p_user_id;

    update public.campaigns
    set current_views = current_views + 1,
        qualified_users = qualified_users + 1,
        coins_paid = coins_paid + c.coin_reward_per_user,
        dollars_paid = dollars_paid + c.dollar_reward_per_user,
        status = case
          when current_views + 1 >= target_views then 'completed'
          else status
        end
    where id = c.id;
  end if;
end;
$$;
revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;


-- One content can be watched only once by each user.
-- This is separate from campaign_qualifications because a content item
-- must not reappear even when it is not attached to an active campaign.
create table if not exists public.content_watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  watched_at timestamptz not null default now(),
  unique(user_id, content_id)
);

alter table public.content_watch_history enable row level security;

drop policy if exists content_watch_history_read_self
on public.content_watch_history;

create policy content_watch_history_read_self
on public.content_watch_history
for select
using (
  user_id = auth.uid() or public.is_admin()
);

-- Server-side insert prevents users from writing another user's history.
create or replace function public.mark_content_watched(
  p_user_id uuid,
  p_content_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  insert into public.content_watch_history(
    user_id,
    content_id
  )
  values(
    p_user_id,
    p_content_id
  )
  on conflict(user_id,content_id) do nothing;
end;
$$;

revoke all on function public.mark_content_watched(uuid,uuid) from public;
grant execute on function public.mark_content_watched(uuid,uuid) to authenticated;
