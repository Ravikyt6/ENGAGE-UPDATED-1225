-- Dynamic admin-managed user view milestones.
create table if not exists public.milestone_configs (
  id uuid primary key default gen_random_uuid(),
  views integer not null check (views > 0),
  reward_rupees numeric(18,4) not null check (reward_rupees > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.milestone_configs enable row level security;
drop policy if exists milestone_configs_read_active on public.milestone_configs;
create policy milestone_configs_read_active on public.milestone_configs for select to authenticated using (active = true or public.is_admin());
drop policy if exists milestone_configs_admin_insert on public.milestone_configs;
create policy milestone_configs_admin_insert on public.milestone_configs for insert to authenticated with check (public.is_admin());
drop policy if exists milestone_configs_admin_update on public.milestone_configs;
create policy milestone_configs_admin_update on public.milestone_configs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists milestone_configs_admin_delete on public.milestone_configs;
create policy milestone_configs_admin_delete on public.milestone_configs for delete to authenticated using (public.is_admin());

insert into public.milestone_configs (views, reward_rupees, sort_order, active)
select 50, 10, 0, true where not exists (select 1 from public.milestone_configs);
insert into public.milestone_configs (views, reward_rupees, sort_order, active)
select 100, 20, 1, true where not exists (select 1 from public.milestone_configs where views = 100);

drop function if exists public.qualify_campaign_view(uuid,uuid);
create or replace function public.qualify_campaign_view(p_campaign_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.campaigns%rowtype;
  total_views integer;
  m record;
  milestone_coins numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or c.status <> 'active' then return; end if;
  if c.creator_id = p_user_id then return; end if;
  if c.current_views >= c.target_views then update public.campaigns set status = 'completed' where id = c.id; return; end if;

  insert into public.campaign_qualifications(campaign_id,user_id,watch_seconds,coins_awarded,dollars_awarded)
  values(c.id,p_user_id,c.required_watch_seconds,c.coin_reward_per_user,c.dollar_reward_per_user)
  on conflict(campaign_id,user_id) do nothing;

  if found then
    update public.wallets set coins = coins + c.coin_reward_per_user, earnings = earnings + c.dollar_reward_per_user, updated_at = now() where user_id = p_user_id;
    update public.campaigns set current_views = current_views + 1, qualified_users = qualified_users + 1, coins_paid = coins_paid + c.coin_reward_per_user, dollars_paid = dollars_paid + c.dollar_reward_per_user, status = case when current_views + 1 >= target_views then 'completed' else status end where id = c.id;
    select count(*)::integer into total_views from public.campaign_qualifications where user_id = p_user_id;

    for m in select id, views, reward_rupees from public.milestone_configs where active = true and views > 0 and reward_rupees > 0 order by views asc loop
      if total_views >= m.views then
        insert into public.user_view_milestones(user_id,milestone_views,reward_rupees) values(p_user_id,m.views,m.reward_rupees) on conflict(user_id,milestone_views) do nothing;
        if found then
          milestone_coins := m.reward_rupees / 0.0002;
          update public.wallets set coins = coins + milestone_coins, earnings = earnings + m.reward_rupees, updated_at = now() where user_id = p_user_id;
          insert into public.wallet_transactions(user_id,type,coins,balance_after,description,reference_id)
          select p_user_id,'bonus',milestone_coins,w.coins,format('%s qualified views milestone reward: ₹%s',m.views,m.reward_rupees),'view-milestone-' || m.id from public.wallets w where w.user_id = p_user_id;
        end if;
      end if;
    end loop;
  end if;
end;
$$;
revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;
