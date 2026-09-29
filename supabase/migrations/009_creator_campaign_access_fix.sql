-- Creator campaign access fix
-- Creator-role accounts are campaign creators even if account_type was previously
-- set to earning. Normal earning users remain blocked.

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
  usd_per_coin numeric;
  creator_role text;
  creator_account_type text;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then
    raise exception 'Unauthorized';
  end if;

  select role, account_type
    into creator_role, creator_account_type
  from public.profiles
  where id = p_creator_id;

  -- Campaign creation is available to creator-role accounts and promotion
  -- accounts. Normal earning/user accounts cannot create campaigns.
  if coalesce(creator_role, '') not in ('admin', 'creator')
     and coalesce(creator_account_type, '') <> 'promotion' then
    raise exception 'Only creator/promotion accounts can create campaigns';
  end if;

  if coalesce(trim(p_creation_request_id), '') = '' then raise exception 'Creation request id is required'; end if;
  if p_target_views is null or p_target_views <= 0 then raise exception 'Target users must be greater than 0'; end if;
  if p_required_watch_seconds is null or p_required_watch_seconds < 30 then raise exception 'Required watch time must be at least 30 seconds'; end if;
  if mod(p_required_watch_seconds, 30) <> 0 then raise exception 'Required watch time must use 30-second increments'; end if;
  if p_type not in ('video','shorts','live') then raise exception 'Invalid campaign type'; end if;
  if p_type = 'shorts' and p_required_watch_seconds >= 60 then raise exception 'Shorts watch requirement must be below 60 seconds'; end if;

  select * into existing from public.campaigns where creation_request_id = p_creation_request_id limit 1;
  if found then
    if existing.creator_id <> p_creator_id then raise exception 'Invalid creation request'; end if;
    return existing;
  end if;

  select coalesce(viewer_reward_usd_per_coin, 0.0002) into usd_per_coin
  from public.app_settings where id = 1;

  reward_per_user := (p_required_watch_seconds::numeric / 30) * 5;
  viewer_pool := p_target_views::numeric * reward_per_user;
  final_cost := ceil(viewer_pool * 1.15);

  select coins into wallet_coins from public.wallets where user_id = p_creator_id for update;
  if wallet_coins is null then raise exception 'Wallet not found'; end if;
  if wallet_coins < final_cost then raise exception 'Insufficient coins. % coins required.', final_cost::bigint; end if;

  insert into public.campaigns(
    creator_id, content_id, title, type, target_views,
    required_watch_seconds, coin_reward_per_user,
    dollar_reward_per_user, creation_cost, creation_request_id
  ) values (
    p_creator_id, p_content_id, p_title, p_type, p_target_views,
    p_required_watch_seconds, reward_per_user,
    reward_per_user * usd_per_coin, final_cost, p_creation_request_id
  ) returning * into result;

  update public.wallets set coins = wallet_coins - final_cost, updated_at = now()
  where user_id = p_creator_id;

  insert into public.wallet_transactions(user_id,type,coins,balance_after,description,reference_id)
  values(p_creator_id,'spend',final_cost,wallet_coins-final_cost,'Campaign creation: ' || p_title,result.id);

  return result;
end;
$$;

revoke all on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) from public;
grant execute on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) to authenticated;

-- Repair existing creator/admin profiles that may have been switched back to
-- earning by an older client. Their role remains the authoritative creator role.
update public.profiles
set account_type = 'promotion'
where role in ('admin','creator')
  and account_type <> 'promotion';

-- Creator/admin roles must stay promotion-type when the client calls this RPC.
create or replace function public.set_my_account_type(p_account_type text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles%rowtype;
  current_role text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_account_type not in ('earning','promotion') then
    raise exception 'Invalid account type';
  end if;

  select role into current_role from public.profiles where id = auth.uid();
  if current_role in ('admin','creator') then
    p_account_type := 'promotion';
  end if;

  update public.profiles
  set account_type = p_account_type
  where id = auth.uid()
  returning * into result;

  if not found then
    raise exception 'Profile not found';
  end if;

  return result;
end;
$$;

revoke all on function public.set_my_account_type(text) from public;
grant execute on function public.set_my_account_type(text) to authenticated;
