-- ENGAGE Admin User 360 / Users Detail migration
-- Run after 003_wallet_system.sql.
-- All admin detail reads and balance/status mutations are server-side.

alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active','suspended','banned'));

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check check (type in ('earning','spend','purchase','bonus','refund','withdrawal','admin_adjustment','referral'));

alter table public.app_settings
  add column if not exists viewer_reward_usd_per_coin numeric(18,8) not null default 0.0002;

-- Keep the conversion in one database setting as well as one frontend constant.
update public.app_settings
set viewer_reward_usd_per_coin = coalesce(viewer_reward_usd_per_coin, 0.0002)
where id = 1;

create table if not exists public.user_admin_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_admin_audit_user_created_idx
  on public.user_admin_audit(user_id, created_at desc);

alter table public.user_admin_audit enable row level security;
drop policy if exists user_admin_audit_admin_read on public.user_admin_audit;
create policy user_admin_audit_admin_read
on public.user_admin_audit for select
using (public.is_admin());

-- Optional withdrawal ledger for the admin profile. Existing projects that do not
-- use withdrawals simply show an empty withdrawal history.
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_amount numeric(18,4) not null default 0,
  coins_deducted numeric(18,4) not null default 0,
  payment_method text not null default 'UPI',
  status text not null default 'pending'
    check (status in ('pending','processing','completed','rejected','failed')),
  reference_id text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists withdrawals_user_requested_idx
  on public.withdrawals(user_id, requested_at desc);

alter table public.withdrawals enable row level security;
drop policy if exists withdrawals_admin_read on public.withdrawals;
create policy withdrawals_admin_read
on public.withdrawals for select
using (public.is_admin() or user_id = auth.uid());

-- Replace the campaign RPC so the configured conversion is authoritative.
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
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then raise exception 'Unauthorized'; end if;
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

-- Recreate qualification RPC with the configured conversion and activity audit.
drop function if exists public.qualify_campaign_view(uuid,uuid);
create or replace function public.qualify_campaign_view(p_campaign_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.campaigns%rowtype;
  new_balance numeric;
  usd_value numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
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

-- ================================================================
-- ADMIN USER LIST
-- ================================================================
drop function if exists public.admin_list_users(integer,integer,text,text);
create or replace function public.admin_list_users(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default '',
  p_status text default ''
)
returns table(
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  role text,
  status text,
  created_at timestamptz,
  email_verified boolean,
  last_active_at timestamptz,
  coin_balance numeric,
  total_users bigint
)
language plpgsql security definer set search_path=public as $$
declare
  off integer := greatest(p_page-1,0) * least(greatest(p_page_size,1),100);
  lim integer := least(greatest(p_page_size,1),100);
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  return query
  with base as (
    select p.*, au.email_confirmed_at,
      greatest(
        greatest(p.created_at, au.last_sign_in_at),
        (select max(created_at) from public.wallet_transactions wt where wt.user_id=p.id),
        (select max(watched_at) from public.content_watch_history wh where wh.user_id=p.id),
        (select max(created_at) from public.campaigns c where c.creator_id=p.id),
        (select max(qualified_at) from public.campaign_qualifications cq where cq.user_id=p.id)
      ) as last_active,
      coalesce((select coins from public.wallets w where w.user_id=p.id),0) as balance
    from public.profiles p
    left join auth.users au on au.id=p.id
    where (
      coalesce(p_search,'')='' or
      p.name ilike '%'||p_search||'%' or p.email ilike '%'||p_search||'%' or p.id::text ilike '%'||p_search||'%'
    ) and (coalesce(p_status,'')='' or p.status=p_status)
  )
  select b.id,b.email,b.name,b.avatar_url,b.role,b.status,b.created_at,
         (b.email_confirmed_at is not null),b.last_active,b.balance,
         count(*) over()::bigint
  from base b
  order by b.created_at desc
  offset off limit lim;
end;
$$;
revoke all on function public.admin_list_users(integer,integer,text,text) from public;
grant execute on function public.admin_list_users(integer,integer,text,text) to authenticated;

-- ================================================================
-- ADMIN USER OVERVIEW
-- ================================================================
drop function if exists public.admin_get_user_overview(uuid);
create or replace function public.admin_get_user_overview(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  p public.profiles%rowtype;
  au auth.users%rowtype;
  w public.wallets%rowtype;
  usd_per_coin numeric;
  watched_count bigint;
  completed_count bigint;
  total_watch_seconds bigint;
  campaign_count bigint;
  active_campaigns bigint;
  completed_campaigns bigint;
  paused_campaigns bigint;
  cancelled_campaigns bigint;
  total_target bigint;
  total_completed bigint;
  campaign_spend numeric;
  purchased numeric;
  earned numeric;
  spent numeric;
  refunded numeric;
  withdrawn numeric;
  pending_withdrawal numeric;
  withdrawal_count bigint;
  last_withdrawal timestamptz;
  last_activity timestamptz;
  last_video_title text;
  total_watch_hours numeric;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  select * into p from public.profiles where id=p_user_id;
  if not found then raise exception 'User not found'; end if;
  select * into au from auth.users where id=p_user_id;
  select * into w from public.wallets where user_id=p_user_id;
  select coalesce(viewer_reward_usd_per_coin,0.0002) into usd_per_coin from public.app_settings where id=1;

  select count(*) into watched_count from public.content_watch_history where user_id=p_user_id;
  select count(*) into completed_count from public.campaign_qualifications where user_id=p_user_id;
  select coalesce(sum(watch_seconds),0) into total_watch_seconds from public.campaign_qualifications where user_id=p_user_id;

  select count(*), count(*) filter(where status='active'), count(*) filter(where status='completed'),
         count(*) filter(where status='paused'), count(*) filter(where status='cancelled'),
         coalesce(sum(target_views),0), coalesce(sum(qualified_users),0),
         coalesce((select sum(wt.coins) from public.wallet_transactions wt join public.campaigns cx on cx.id=wt.reference_id where wt.user_id=p_user_id and wt.type='spend'),0)
  into campaign_count,active_campaigns,completed_campaigns,paused_campaigns,cancelled_campaigns,total_target,total_completed,campaign_spend
  from public.campaigns where creator_id=p_user_id;

  select coalesce(sum(coins) filter(where type='purchase'),0),
         coalesce(sum(coins) filter(where type in ('earning','bonus','referral')),0),
         coalesce(sum(coins) filter(where type='spend'),0),
         coalesce(sum(coins) filter(where type='refund'),0)
  into purchased,earned,spent,refunded
  from public.wallet_transactions where user_id=p_user_id;

  select coalesce(sum(coins_deducted) filter(where status in ('completed','processing','pending')),0),
         coalesce(sum(coins_deducted) filter(where status in ('pending','processing')),0),
         count(*), max(coalesce(completed_at,requested_at))
  into withdrawn,pending_withdrawal,withdrawal_count,last_withdrawal
  from public.withdrawals where user_id=p_user_id;

  select greatest(
    p.created_at,
    au.last_sign_in_at,
    (select max(watched_at) from public.content_watch_history where user_id=p_user_id),
    (select max(created_at) from public.wallet_transactions where user_id=p_user_id),
    (select max(created_at) from public.campaigns where creator_id=p_user_id),
    (select max(qualified_at) from public.campaign_qualifications where user_id=p_user_id),
    (select max(requested_at) from public.withdrawals where user_id=p_user_id),
    (select max(created_at) from public.user_admin_audit where user_id=p_user_id)
  ) into last_activity;

  total_watch_hours := total_watch_seconds::numeric / 3600.0;
  select ct.title into last_video_title
  from public.content_watch_history wh
  left join public.contents ct on ct.id=wh.content_id
  where wh.user_id=p_user_id
  order by wh.watched_at desc limit 1;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id',p.id,'email',p.email,'name',p.name,'role',p.role,'status',p.status,
      'avatarUrl',p.avatar_url,'createdAt',p.created_at,'emailVerified',au.email_confirmed_at is not null,
      'emailVerifiedAt',au.email_confirmed_at,'lastSignInAt',au.last_sign_in_at,'lastActiveAt',last_activity,
      'coinBalance',coalesce(w.coins,0)
    ),
    'coins', jsonb_build_object(
      'currentBalance',coalesce(w.coins,0),'totalPurchased',purchased,'totalEarned',earned,
      'totalSpent',spent,'totalViewerRewards',coalesce((select sum(coins) from public.wallet_transactions where user_id=p_user_id and type='earning'),0),
      'campaignSpend',campaign_spend,'refunded',refunded
    ),
    'earnings', jsonb_build_object(
      'totalCoinsEarned',earned,'usdPerCoin',usd_per_coin,'totalUsdEquivalent',earned*usd_per_coin,
      'totalWithdrawnCoins',withdrawn,'pendingWithdrawalCoins',pending_withdrawal,
      'availableWithdrawalCoins',greatest(coalesce(w.coins,0)-pending_withdrawal,0),
      'withdrawalCount',withdrawal_count,'lastWithdrawalAt',last_withdrawal
    ),
    'viewActivity', jsonb_build_object(
      'videosWatched',watched_count,'completed',completed_count,
      'incomplete',greatest(watched_count-completed_count,0),'totalWatchSeconds',total_watch_seconds,
      'averageWatchSeconds',case when completed_count=0 then 0 else round(total_watch_seconds::numeric/completed_count,2) end,
      'coinsEarnedFromWatching',coalesce((select sum(coins) from public.wallet_transactions where user_id=p_user_id and type='earning'),0),
      'lastVideoWatchedAt',(select max(watched_at) from public.content_watch_history where user_id=p_user_id),
      'lastVideoWatchedTitle',last_video_title,
      'lastActivityAt',last_activity,'totalWatchHours',total_watch_hours
    ),
    'campaigns', jsonb_build_object(
      'created',campaign_count,'active',active_campaigns,'completed',completed_campaigns,
      'paused',paused_campaigns,'cancelled',cancelled_campaigns,'coinsSpent',campaign_spend,
      'targetUsers',total_target,'completedUsers',total_completed
    )
  );
end;
$$;
revoke all on function public.admin_get_user_overview(uuid) from public;
grant execute on function public.admin_get_user_overview(uuid) to authenticated;

-- ================================================================
-- PAGINATED ADMIN TABLE READS
-- ================================================================
drop function if exists public.admin_list_user_transactions(uuid,integer,integer,text,timestamptz,timestamptz,text);
create or replace function public.admin_list_user_transactions(
  p_user_id uuid,p_page integer default 1,p_page_size integer default 20,p_type text default '',
  p_date_from timestamptz default null,p_date_to timestamptz default null,p_search text default ''
)
returns table(id uuid,created_at timestamptz,type text,description text,coins numeric,balance_after numeric,reference_id uuid,status text,total_count bigint)
language plpgsql security definer set search_path=public as $$
declare off integer:=greatest(p_page-1,0)*least(greatest(p_page_size,1),100); lim integer:=least(greatest(p_page_size,1),100);
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 return query
 select wt.id,wt.created_at,wt.type,wt.description,wt.coins,wt.balance_after,wt.reference_id,'completed'::text,count(*) over()::bigint
 from public.wallet_transactions wt
 where wt.user_id=p_user_id
   and (coalesce(p_type,'')='' or wt.type=p_type)
   and (p_date_from is null or wt.created_at>=p_date_from)
   and (p_date_to is null or wt.created_at<=p_date_to)
   and (coalesce(p_search,'')='' or wt.description ilike '%'||p_search||'%')
 order by wt.created_at desc offset off limit lim;
end;
$$;
revoke all on function public.admin_list_user_transactions(uuid,integer,integer,text,timestamptz,timestamptz,text) from public;
grant execute on function public.admin_list_user_transactions(uuid,integer,integer,text,timestamptz,timestamptz,text) to authenticated;

drop function if exists public.admin_list_user_campaigns(uuid,integer,integer,text,timestamptz,timestamptz);
create or replace function public.admin_list_user_campaigns(
  p_user_id uuid,p_page integer default 1,p_page_size integer default 20,p_status text default '',
  p_date_from timestamptz default null,p_date_to timestamptz default null
)
returns table(id uuid,title text,content_title text,target_users integer,required_watch_seconds integer,reward_per_user numeric,campaign_cost numeric,completed_users integer,status text,created_at timestamptz,total_count bigint)
language plpgsql security definer set search_path=public as $$
declare off integer:=greatest(p_page-1,0)*least(greatest(p_page_size,1),100); lim integer:=least(greatest(p_page_size,1),100);
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 return query
 select c.id,c.title,coalesce(ct.title,'—'),c.target_views,c.required_watch_seconds,c.coin_reward_per_user,c.creation_cost,c.qualified_users,c.status,c.created_at,count(*) over()::bigint
 from public.campaigns c left join public.contents ct on ct.id=c.content_id
 where c.creator_id=p_user_id
   and (coalesce(p_status,'')='' or c.status=p_status)
   and (p_date_from is null or c.created_at>=p_date_from)
   and (p_date_to is null or c.created_at<=p_date_to)
 order by c.created_at desc offset off limit lim;
end;
$$;
revoke all on function public.admin_list_user_campaigns(uuid,integer,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.admin_list_user_campaigns(uuid,integer,integer,text,timestamptz,timestamptz) to authenticated;

drop function if exists public.admin_list_user_withdrawals(uuid,integer,integer,text,timestamptz,timestamptz);
create or replace function public.admin_list_user_withdrawals(
  p_user_id uuid,p_page integer default 1,p_page_size integer default 20,p_status text default '',
  p_date_from timestamptz default null,p_date_to timestamptz default null
)
returns table(id uuid,requested_at timestamptz,requested_amount numeric,coins_deducted numeric,payment_method text,status text,reference_id text,completed_at timestamptz,total_count bigint)
language plpgsql security definer set search_path=public as $$
declare off integer:=greatest(p_page-1,0)*least(greatest(p_page_size,1),100); lim integer:=least(greatest(p_page_size,1),100);
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 return query
 select w.id,w.requested_at,w.requested_amount,w.coins_deducted,w.payment_method,w.status,w.reference_id,w.completed_at,count(*) over()::bigint
 from public.withdrawals w
 where w.user_id=p_user_id
   and (coalesce(p_status,'')='' or w.status=p_status)
   and (p_date_from is null or w.requested_at>=p_date_from)
   and (p_date_to is null or w.requested_at<=p_date_to)
 order by w.requested_at desc offset off limit lim;
end;
$$;
revoke all on function public.admin_list_user_withdrawals(uuid,integer,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.admin_list_user_withdrawals(uuid,integer,integer,text,timestamptz,timestamptz) to authenticated;

-- Unified activity timeline. It is intentionally paginated server-side.
drop function if exists public.admin_list_user_activity(uuid,integer,integer,text,timestamptz,timestamptz);
create or replace function public.admin_list_user_activity(
  p_user_id uuid,p_page integer default 1,p_page_size integer default 20,p_type text default '',
  p_date_from timestamptz default null,p_date_to timestamptz default null
)
returns table(id text,occurred_at timestamptz,event_type text,title text,description text,metadata jsonb,total_count bigint)
language plpgsql security definer set search_path=public as $$
declare off integer:=greatest(p_page-1,0)*least(greatest(p_page_size,1),100); lim integer:=least(greatest(p_page_size,1),100);
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 return query
 with events as (
   select ('profile:'||p.id::text) id,p.created_at occurred_at,'account_created' event_type,'Account created' title,'User account was created' description,jsonb_build_object('userId',p.id) metadata
   from public.profiles p where p.id=p_user_id
   union all
   select ('verified:'||p.id::text) id,au.email_confirmed_at,'email_verified','Email verified','Email address was verified',jsonb_build_object('email',p.email)
   from public.profiles p join auth.users au on au.id=p.id where p.id=p_user_id and au.email_confirmed_at is not null
   union all
   select ('tx:'||wt.id::text) id,wt.created_at,wt.type,'Wallet transaction',wt.description,jsonb_build_object('coins',wt.coins,'balanceAfter',wt.balance_after,'referenceId',wt.reference_id)
   from public.wallet_transactions wt where wt.user_id=p_user_id
   union all
   select ('campaign:'||c.id::text) id,c.created_at,'campaign_created','Campaign created',c.title,jsonb_build_object('campaignId',c.id,'status',c.status,'target',c.target_views)
   from public.campaigns c where c.creator_id=p_user_id
   union all
   select ('completion:'||cq.id::text) id,cq.qualified_at,'task_completed','Video/task completed',coalesce(c.title,'Campaign task completed'),jsonb_build_object('campaignId',cq.campaign_id,'watchSeconds',cq.watch_seconds,'coins',cq.coins_awarded)
   from public.campaign_qualifications cq left join public.campaigns c on c.id=cq.campaign_id where cq.user_id=p_user_id
   union all
   select ('withdrawal:'||w.id::text) id,w.requested_at,'withdrawal_'||w.status,'Withdrawal '||initcap(w.status),'Withdrawal request: '||w.payment_method,jsonb_build_object('withdrawalId',w.id,'coins',w.coins_deducted,'status',w.status,'referenceId',w.reference_id)
   from public.withdrawals w where w.user_id=p_user_id
   union all
   select ('audit:'||a.id::text) id,a.created_at,a.event_type,'Admin action',a.description,a.metadata
   from public.user_admin_audit a where a.user_id=p_user_id
 )
 select e.id,e.occurred_at,e.event_type,e.title,e.description,e.metadata,count(*) over()::bigint
 from events e
 where (coalesce(p_type,'')='' or e.event_type=p_type)
   and (p_date_from is null or e.occurred_at>=p_date_from)
   and (p_date_to is null or e.occurred_at<=p_date_to)
 order by e.occurred_at desc offset off limit lim;
end;
$$;
revoke all on function public.admin_list_user_activity(uuid,integer,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.admin_list_user_activity(uuid,integer,integer,text,timestamptz,timestamptz) to authenticated;

-- ================================================================
-- ADMIN MUTATIONS / AUDIT
-- ================================================================
drop function if exists public.admin_adjust_user_coins(uuid,numeric,text);
create or replace function public.admin_adjust_user_coins(p_user_id uuid,p_amount numeric,p_reason text)
returns public.wallet_transactions
language plpgsql security definer set search_path=public as $$
declare
  w public.wallets%rowtype;
  new_balance numeric;
  tx public.wallet_transactions%rowtype;
  kind text;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if p_amount=0 then raise exception 'Adjustment amount cannot be zero'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'Reason is required'; end if;
  select * into w from public.wallets where user_id=p_user_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  new_balance:=w.coins+p_amount;
  if new_balance<0 then raise exception 'Insufficient coins for removal'; end if;
  kind:='admin_adjustment';
  update public.wallets set coins=new_balance,updated_at=now() where user_id=p_user_id;
  insert into public.wallet_transactions(user_id,type,coins,balance_after,description,reference_id)
  values(p_user_id,kind,abs(p_amount),new_balance,case when p_amount>0 then 'Admin added coins: ' else 'Admin removed coins: ' end || p_reason,null)
  returning * into tx;
  insert into public.user_admin_audit(user_id,admin_id,event_type,description,metadata)
  values(p_user_id,auth.uid(),'coins_adjusted',case when p_amount>0 then 'Added ' else 'Removed ' end || abs(p_amount)::text || ' coins: ' || p_reason,
         jsonb_build_object('amount',p_amount,'reason',p_reason,'transactionId',tx.id));
  return tx;
end;
$$;
revoke all on function public.admin_adjust_user_coins(uuid,numeric,text) from public;
grant execute on function public.admin_adjust_user_coins(uuid,numeric,text) to authenticated;

drop function if exists public.admin_update_user_status(uuid,text,text);
create or replace function public.admin_update_user_status(p_user_id uuid,p_status text,p_reason text default '')
returns public.profiles
language plpgsql security definer set search_path=public as $$
declare
  result public.profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'Invalid status'; end if;
  update public.profiles set status=p_status where id=p_user_id returning * into result;
  if not found then raise exception 'User not found'; end if;
  insert into public.user_admin_audit(user_id,admin_id,event_type,description,metadata)
  values(p_user_id,auth.uid(),'account_status_changed','Account status changed to '||p_status,
         jsonb_build_object('status',p_status,'reason',coalesce(p_reason,'')));
  return result;
end;
$$;
revoke all on function public.admin_update_user_status(uuid,text,text) from public;
grant execute on function public.admin_update_user_status(uuid,text,text) to authenticated;

drop function if exists public.admin_update_user_name(uuid,text);
create or replace function public.admin_update_user_name(p_user_id uuid,p_name text)
returns public.profiles
language plpgsql security definer set search_path=public as $$
declare result public.profiles%rowtype;
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 if coalesce(trim(p_name),'')='' then raise exception 'Name is required'; end if;
 update public.profiles set name=trim(p_name) where id=p_user_id returning * into result;
 if not found then raise exception 'User not found'; end if;
 insert into public.user_admin_audit(user_id,admin_id,event_type,description,metadata)
 values(p_user_id,auth.uid(),'user_edited','User profile updated',jsonb_build_object('name',trim(p_name)));
 return result;
end;
$$;
revoke all on function public.admin_update_user_name(uuid,text) from public;
grant execute on function public.admin_update_user_name(uuid,text) to authenticated;
