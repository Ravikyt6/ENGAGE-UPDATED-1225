-- User-level cumulative view milestones.
-- 50 qualified views -> ₹10 bonus
-- 100 qualified views -> ₹20 bonus
-- Milestones are cumulative across campaigns and can only be paid once per user.

create table if not exists public.user_view_milestones (
  user_id uuid not null references public.profiles(id) on delete cascade,
  milestone_views integer not null,
  reward_rupees numeric(18,4) not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, milestone_views),
  check (milestone_views in (50, 100)),
  check (reward_rupees > 0)
);

alter table public.user_view_milestones enable row level security;

drop policy if exists user_view_milestones_read_self on public.user_view_milestones;
create policy user_view_milestones_read_self
on public.user_view_milestones
for select
using (user_id = auth.uid() or public.is_admin());

-- Replace the qualification RPC with milestone-aware reward handling.
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
  milestone_reward numeric;
  milestone_coins numeric;
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

    -- Count all qualified campaign views for this user.
    select count(*)::integer
    into total_views
    from public.campaign_qualifications
    where user_id = p_user_id;

    -- Milestones are independent, one-time bonuses.
    if total_views >= 50 then
      insert into public.user_view_milestones(user_id, milestone_views, reward_rupees)
      values(p_user_id, 50, 10)
      on conflict(user_id, milestone_views) do nothing;

      if found then
        milestone_reward := 10;
        milestone_coins := milestone_reward / 0.0002;

        update public.wallets
        set coins = coins + milestone_coins,
            earnings = earnings + milestone_reward,
            updated_at = now()
        where user_id = p_user_id;

        insert into public.wallet_transactions(
          user_id, type, coins, balance_after, description, reference_id
        )
        select
          p_user_id,
          'bonus',
          milestone_coins,
          w.coins,
          '50 qualified views milestone reward: ₹10',
          'view-milestone-50'
        from public.wallets w
        where w.user_id = p_user_id;
      end if;
    end if;

    if total_views >= 100 then
      insert into public.user_view_milestones(user_id, milestone_views, reward_rupees)
      values(p_user_id, 100, 20)
      on conflict(user_id, milestone_views) do nothing;

      if found then
        milestone_reward := 20;
        milestone_coins := milestone_reward / 0.0002;

        update public.wallets
        set coins = coins + milestone_coins,
            earnings = earnings + milestone_reward,
            updated_at = now()
        where user_id = p_user_id;

        insert into public.wallet_transactions(
          user_id, type, coins, balance_after, description, reference_id
        )
        select
          p_user_id,
          'bonus',
          milestone_coins,
          w.coins,
          '100 qualified views milestone reward: ₹20',
          'view-milestone-100'
        from public.wallets w
        where w.user_id = p_user_id;
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;
