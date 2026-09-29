-- Ad settings migration: controls the Profitableratecpm Social Bar script.
alter table public.app_settings
  add column if not exists social_bar_enabled boolean not null default false;

-- ENGAGE campaign economy + ad settings migration
-- Run after 001_engage_schema.sql on an existing Supabase project.

alter table public.campaigns
  add column if not exists creation_request_id text;

create unique index if not exists campaigns_creation_request_id_uidx
on public.campaigns(creation_request_id)
where creation_request_id is not null;

-- Authoritative campaign calculation:
-- reward/user = (watch_seconds / 30) * 5
-- final campaign cost = ceil(target_users * reward/user * 1.15)
-- viewer dollar value = reward/user * 0.0002
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

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or c.status <> 'active' then return; end if;
  if c.creator_id = p_user_id then return; end if;

  if c.current_views >= c.target_views then
    update public.campaigns set status = 'completed' where id = c.id;
    return;
  end if;

  insert into public.campaign_qualifications(
    campaign_id,user_id,watch_seconds,coins_awarded,dollars_awarded
  )
  values(
    c.id,p_user_id,c.required_watch_seconds,
    c.coin_reward_per_user,c.dollar_reward_per_user
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
        status = case when current_views + 1 >= target_views then 'completed' else status end
    where id = c.id;
  end if;
end;
$$;

revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;
