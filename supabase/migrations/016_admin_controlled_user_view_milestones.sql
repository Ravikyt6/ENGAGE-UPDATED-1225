-- Admin-controlled user view milestones.
-- Defaults preserve the current behavior: 50 views -> ₹10, then 100 views -> ₹20.

alter table public.app_settings
  add column if not exists milestone1_views integer not null default 50,
  add column if not exists milestone1_reward_rupees numeric(18,4) not null default 10,
  add column if not exists milestone2_views integer not null default 100,
  add column if not exists milestone2_reward_rupees numeric(18,4) not null default 20;

-- Existing milestone records remain valid, but the configured thresholds are no longer
-- hard-coded to 50/100 for future awards.
alter table public.user_view_milestones
  drop constraint if exists user_view_milestones_milestone_views_check;
alter table public.user_view_milestones
  add constraint user_view_milestones_milestone_views_check check (milestone_views > 0);

-- Rebuild qualification so the admin settings control milestone thresholds/rewards.
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
  total_views integer;
  m1_views integer;
  m2_views integer;
  m1_reward numeric;
  m2_reward numeric;
  milestone_reward numeric;
  milestone_coins numeric;
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
    c.id, p_user_id, c.required_watch_seconds,
    c.coin_reward_per_user, c.dollar_reward_per_user
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

    select count(*)::integer into total_views
    from public.campaign_qualifications
    where user_id = p_user_id;

    select
      milestone1_views,
      milestone1_reward_rupees,
      milestone2_views,
      milestone2_reward_rupees
    into m1_views, m1_reward, m2_views, m2_reward
    from public.app_settings
    where id = 1;

    if m1_views is null then m1_views := 50; end if;
    if m1_reward is null then m1_reward := 10; end if;
    if m2_views is null then m2_views := 100; end if;
    if m2_reward is null then m2_reward := 20; end if;

    if m1_views > 0 and m1_reward > 0 and total_views >= m1_views then
      insert into public.user_view_milestones(user_id, milestone_views, reward_rupees)
      values(p_user_id, m1_views, m1_reward)
      on conflict(user_id, milestone_views) do nothing;

      if found then
        milestone_reward := m1_reward;
        milestone_coins := milestone_reward / 0.0002;
        update public.wallets
        set coins = coins + milestone_coins,
            earnings = earnings + milestone_reward,
            updated_at = now()
        where user_id = p_user_id;

        insert into public.wallet_transactions(user_id, type, coins, balance_after, description, reference_id)
        select p_user_id, 'bonus', milestone_coins, w.coins,
               format('%s qualified views milestone reward: ₹%s', m1_views, m1_reward),
               'view-milestone-' || m1_views
        from public.wallets w where w.user_id = p_user_id;
      end if;
    end if;

    if m2_views > 0 and m2_reward > 0 and m2_views > m1_views and total_views >= m2_views then
      insert into public.user_view_milestones(user_id, milestone_views, reward_rupees)
      values(p_user_id, m2_views, m2_reward)
      on conflict(user_id, milestone_views) do nothing;

      if found then
        milestone_reward := m2_reward;
        milestone_coins := milestone_reward / 0.0002;
        update public.wallets
        set coins = coins + milestone_coins,
            earnings = earnings + milestone_reward,
            updated_at = now()
        where user_id = p_user_id;

        insert into public.wallet_transactions(user_id, type, coins, balance_after, description, reference_id)
        select p_user_id, 'bonus', milestone_coins, w.coins,
               format('%s qualified views milestone reward: ₹%s', m2_views, m2_reward),
               'view-milestone-' || m2_views
        from public.wallets w where w.user_id = p_user_id;
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;
