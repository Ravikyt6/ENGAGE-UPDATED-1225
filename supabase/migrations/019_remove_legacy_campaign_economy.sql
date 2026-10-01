-- Remove the superseded creator coin-spend / per-view campaign economy.
-- Keep milestone rewards and wallet coins; creator campaigns are now package-based.

-- The old RPC accepted arbitrary views/watch time and calculated a coin cost.
drop function if exists public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer);

-- Campaign deletion no longer refunds creator campaign coins because package campaigns
-- do not deduct creator coins. It still keeps history and removes promoted content.
drop function if exists public.delete_campaign_and_refund(uuid,uuid);
create or replace function public.delete_campaign_and_refund(
  p_campaign_id uuid,
  p_creator_id uuid
)
returns table(campaign_id uuid,status text,refunded_coins numeric)
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.campaigns%rowtype;
  content_to_remove uuid;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then raise exception 'Unauthorized'; end if;
  select * into c from public.campaigns where id=p_campaign_id and creator_id=p_creator_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if c.status not in ('active','paused','pending') then raise exception 'This campaign can no longer be deleted'; end if;

  content_to_remove := c.content_id;
  update public.campaigns set status='partial_completed', content_id=null where id=c.id;

  if content_to_remove is not null and not exists (
    select 1 from public.campaigns where content_id=content_to_remove
  ) then
    delete from public.contents where id=content_to_remove;
  end if;

  return query select c.id,'partial_completed'::text,0::numeric;
end;
$$;
revoke all on function public.delete_campaign_and_refund(uuid,uuid) from public;
grant execute on function public.delete_campaign_and_refund(uuid,uuid) to authenticated;


-- Rebuild qualification before dropping the retired campaign reward columns.
drop function if exists public.qualify_campaign_view(uuid,uuid);
create or replace function public.qualify_campaign_view(p_campaign_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  c public.campaigns%rowtype;
  total_views integer;
  m record;
  milestone_coins numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Unauthorized'; end if;
  select * into c from public.campaigns where id=p_campaign_id for update;
  if not found or c.status <> 'active' or c.creator_id = p_user_id then return; end if;
  if c.current_views >= c.target_views then update public.campaigns set status='completed' where id=c.id; return; end if;

  insert into public.campaign_qualifications(campaign_id,user_id,watch_seconds,coins_awarded,dollars_awarded)
  values(c.id,p_user_id,c.required_watch_seconds,0,0)
  on conflict(campaign_id,user_id) do nothing;

  if found then
    update public.campaigns
    set current_views=current_views+1,
        qualified_users=qualified_users+1,
        status=case when current_views+1 >= target_views then 'completed' else status end
    where id=c.id;

    select count(*)::integer into total_views
    from public.campaign_qualifications where user_id=p_user_id;

    for m in select id,views,reward_rupees from public.milestone_configs where active=true and views>0 and reward_rupees>0 order by views asc loop
      if total_views >= m.views then
        insert into public.user_view_milestones(user_id,milestone_views,reward_rupees)
        values(p_user_id,m.views,m.reward_rupees) on conflict(user_id,milestone_views) do nothing;
        if found then
          milestone_coins := m.reward_rupees / 0.0002;
          update public.wallets set coins=coins+milestone_coins, earnings=earnings+m.reward_rupees, updated_at=now() where user_id=p_user_id;
          insert into public.wallet_transactions(user_id,type,coins,balance_after,description,reference_id)
          select p_user_id,'bonus',milestone_coins,w.coins,format('%s qualified views milestone reward: ₹%s',m.views,m.reward_rupees),'view-milestone-' || m.id
          from public.wallets w where w.user_id=p_user_id;
        end if;
      end if;
    end loop;
  end if;
end;
$$;
revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;

-- These campaign columns were only used by the retired coin-spend economy.
alter table public.campaigns
  drop column if exists coin_reward_per_user,
  drop column if exists dollar_reward_per_user,
  drop column if exists creation_cost,
  drop column if exists coins_paid,
  drop column if exists dollars_paid;

-- These settings belonged to the old arbitrary campaign-cost model.
alter table public.app_settings
  drop column if exists reward_per_user,
  drop column if exists campaign_creation_cost,
  drop column if exists milestone1_views,
  drop column if exists milestone1_reward_rupees,
  drop column if exists milestone2_views,
  drop column if exists milestone2_reward_rupees;

-- Keep the existing admin RPC signature, but return package price instead of retired coin cost.
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
 select c.id,c.title,coalesce(ct.title,'—'),c.target_views,c.required_watch_seconds,0::numeric,c.package_price,c.qualified_users,c.status,c.created_at,count(*) over()::bigint
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
