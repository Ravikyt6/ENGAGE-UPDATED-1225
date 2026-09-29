-- Fix admin user overview against the withdrawals schema.
-- withdrawals uses requested_at (not created_at).

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
