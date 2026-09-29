-- ENGAGE WALLET SYSTEM MIGRATION
-- Run after 001_engage_schema.sql and 002_campaign_economy_and_ads.sql.
-- Wallet balances are no longer directly writable by normal users.
-- All balance-changing operations are performed by SECURITY DEFINER RPCs
-- and recorded in wallet_transactions.

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('earning','spend','purchase','bonus','refund')),
  coins numeric(18,4) not null check (coins > 0),
  balance_after numeric(18,4) not null check (balance_after >= 0),
  description text not null default 'Wallet transaction',
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions(user_id, created_at desc);

create index if not exists wallet_transactions_reference_idx
  on public.wallet_transactions(reference_id);

alter table public.wallet_transactions enable row level security;

-- Users can only read their own wallet ledger. No client-side inserts/updates.
drop policy if exists wallet_transactions_self_read on public.wallet_transactions;
create policy wallet_transactions_self_read
on public.wallet_transactions for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists wallets_self_update on public.wallets;

-- Normal users must never be able to directly change wallet balances.
drop policy if exists wallets_self_insert on public.wallets;
drop policy if exists wallets_self_delete on public.wallets;

-- Existing accounts created before the wallet trigger must also have wallets.
insert into public.wallets(user_id, coins, earnings)
select p.id, 1000, 0
from public.profiles p
left join public.wallets w on w.user_id = p.id
where w.user_id is null
on conflict (user_id) do nothing;

-- ================================================================
-- AUTHORITATIVE CAMPAIGN CREATION + WALLET LEDGER
-- ================================================================

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
  new_balance numeric;
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

  if wallet_coins is null then
    raise exception 'Wallet not found';
  end if;

  if wallet_coins < final_cost then
    raise exception 'Insufficient coins. % coins required.', final_cost::bigint;
  end if;

  new_balance := wallet_coins - final_cost;

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
  set coins = new_balance,
      updated_at = now()
  where user_id = p_creator_id;

  insert into public.wallet_transactions(
    user_id, type, coins, balance_after, description, reference_id
  )
  values(
    p_creator_id,
    'spend',
    final_cost,
    new_balance,
    'Campaign creation: ' || p_title,
    result.id
  );

  return result;
end;
$$;

revoke all on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) from public;
grant execute on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) to authenticated;

-- ================================================================
-- AUTHORITATIVE CAMPAIGN VIEWER REWARD + WALLET LEDGER
-- ================================================================

drop function if exists public.qualify_campaign_view(uuid,uuid);

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
  new_balance numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Unauthorized';
  end if;

  select * into c
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
    update public.campaigns set status = 'completed' where id = c.id;
    return;
  end if;

  insert into public.campaign_qualifications(
    campaign_id, user_id, watch_seconds, coins_awarded, dollars_awarded
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
    where user_id = p_user_id
    returning coins into new_balance;

    if new_balance is not null then
      insert into public.wallet_transactions(
        user_id, type, coins, balance_after, description, reference_id
      )
      values(
        p_user_id,
        'earning',
        c.coin_reward_per_user,
        new_balance,
        'Viewer reward: ' || c.title,
        c.id
      );
    end if;

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

-- Optional realtime support for wallet activity screens.
do $$
begin
  alter publication supabase_realtime add table public.wallets;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.wallet_transactions;
exception when duplicate_object then
  null;
end $$;
