-- ENGAGE account types: EARNING vs PROMOTION
-- EARNING: watch Videos/Shorts/Live and earn coins. No campaign creation UI/actions.
-- PROMOTION: create and manage campaigns using coins. No viewer earning UI/actions.
-- Safe migration: existing admin/creator accounts become PROMOTION; existing normal
-- users become EARNING. New users default to EARNING unless signup explicitly selects PROMOTION.

alter table public.profiles
  add column if not exists account_type text not null default 'earning';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('earning','promotion'));

-- Preserve the intended meaning of the existing creator role while giving ordinary
-- users the new viewer/earner experience.
update public.profiles
set account_type = case
  when role in ('admin','creator') then 'promotion'
  else 'earning'
end
where account_type is null
   or account_type not in ('earning','promotion')
   or account_type = 'earning';

-- New Auth users inherit the selected account type from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_account_type text;
begin
  selected_account_type := case
    when new.raw_user_meta_data->>'account_type' in ('earning','promotion')
      then new.raw_user_meta_data->>'account_type'
    else 'earning'
  end;

  insert into public.profiles(id,email,name,role,account_type)
  values (
    new.id,
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name','User'),
    coalesce(new.raw_user_meta_data->>'role','user'),
    selected_account_type
  )
  on conflict (id) do update
    set email = excluded.email,
        name = excluded.name;

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

-- Google OAuth does not reliably carry arbitrary app metadata through the provider
-- redirect, so the frontend stores the selected option temporarily and calls this
-- authenticated RPC after the OAuth session is established.
create or replace function public.set_my_account_type(p_account_type text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if p_account_type not in ('earning','promotion') then
    raise exception 'Invalid account type';
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

-- Server-side campaign creation protection: only PROMOTION accounts may spend
-- coins to create campaigns.
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
  creator_account_type text;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then
    raise exception 'Unauthorized';
  end if;

  select account_type into creator_account_type
  from public.profiles
  where id = p_creator_id;

  if creator_account_type <> 'promotion' then
    raise exception 'Only promotion accounts can create campaigns';
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

-- Server-side viewer reward protection: only EARNING accounts can qualify for
-- campaign watch rewards.
drop function if exists public.qualify_campaign_view(uuid,uuid);
create or replace function public.qualify_campaign_view(p_campaign_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.campaigns%rowtype;
  new_balance numeric;
  viewer_account_type text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;

  select account_type into viewer_account_type
  from public.profiles
  where id = p_user_id;

  if viewer_account_type <> 'earning' then
    raise exception 'Only earning accounts can receive viewer rewards';
  end if;

  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or c.status <> 'active' or c.creator_id = p_user_id then return; end if;
  if c.current_views >= c.target_views then
    update public.campaigns set status='completed' where id=c.id;
    return;
  end if;

  insert into public.campaign_qualifications(campaign_id,user_id,watch_seconds,coins_awarded,dollars_awarded)
  values(c.id,p_user_id,c.required_watch_seconds,c.coin_reward_per_user,c.dollar_reward_per_user)
  on conflict(campaign_id,user_id) do nothing;

  if found then
    update public.wallets
    set coins = coins + c.coin_reward_per_user,
        earnings = earnings + c.dollar_reward_per_user,
        updated_at = now()
    where user_id = p_user_id
    returning coins into new_balance;

    if new_balance is not null then
      insert into public.wallet_transactions(user_id,type,coins,balance_after,description,reference_id)
      values(p_user_id,'earning',c.coin_reward_per_user,new_balance,'Viewer reward: ' || c.title,c.id);
    end if;

    update public.campaigns
    set current_views=current_views+1,
        qualified_users=qualified_users+1,
        coins_paid=coins_paid+c.coin_reward_per_user,
        dollars_paid=dollars_paid+c.dollar_reward_per_user,
        status=case when current_views+1 >= target_views then 'completed' else status end
    where id=c.id;
  end if;
end;
$$;

revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;

-- Backward compatibility for existing profiles: admins/creators are promotion,
-- ordinary users are earning unless explicitly changed later.
update public.profiles
set account_type = case when role in ('admin','creator') then 'promotion' else 'earning' end
where account_type is null;
