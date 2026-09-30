-- Retire the old creator coin-spend / per-view viewer-reward campaign model.
-- Campaign packages are priced in INR; viewer earnings come from user-level milestones.

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
  scale numeric;
  package_price numeric;
  creator_role text;
  creator_account_type text;
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then raise exception 'Unauthorized'; end if;
  select role, account_type into creator_role, creator_account_type from public.profiles where id=p_creator_id;
  if coalesce(creator_role,'') not in ('admin','creator') and coalesce(creator_account_type,'') <> 'promotion' then raise exception 'Only creator/promotion accounts can create campaigns'; end if;
  if p_target_views is null or p_target_views <= 0 then raise exception 'Target users must be greater than 0'; end if;
  if p_required_watch_seconds is null or p_required_watch_seconds < 30 then raise exception 'Required watch time must be at least 30 seconds'; end if;
  if mod(p_required_watch_seconds,30) <> 0 then raise exception 'Required watch time must use 30-second increments'; end if;
  if p_type not in ('video','shorts','live') then raise exception 'Invalid campaign type'; end if;
  if p_type = 'shorts' and p_required_watch_seconds >= 60 then raise exception 'Shorts watch requirement must be below 60 seconds'; end if;

  select * into existing from public.campaigns where creation_request_id=p_creation_request_id limit 1;
  if found then return existing; end if;

  scale := greatest(p_target_views::numeric/100.0, p_required_watch_seconds::numeric/3600.0, 1.0);
  package_price := ceil(99 * scale);

  insert into public.campaigns(creator_id,content_id,title,type,target_views,required_watch_seconds,coin_reward_per_user,dollar_reward_per_user,creation_cost,creation_request_id)
  values(p_creator_id,p_content_id,p_title,p_type,p_target_views,p_required_watch_seconds,0,0,package_price,p_creation_request_id)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) from public;
grant execute on function public.create_campaign_with_cost(text,uuid,uuid,text,text,integer,integer) to authenticated;

-- Replace qualification so campaigns no longer pay per-view coins/INR.
create or replace function public.qualify_campaign_view(p_campaign_id uuid,p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
 c public.campaigns%rowtype;
 total_views integer;
 milestone_reward numeric;
 milestone_coins numeric;
begin
 if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'Unauthorized'; end if;
 select * into c from public.campaigns where id=p_campaign_id for update;
 if not found or c.status<>'active' or c.creator_id=p_user_id then return; end if;
 if c.current_views>=c.target_views then update public.campaigns set status='completed' where id=c.id; return; end if;

 insert into public.campaign_qualifications(campaign_id,user_id,watch_seconds,coins_awarded,dollars_awarded)
 values(c.id,p_user_id,c.required_watch_seconds,0,0) on conflict(campaign_id,user_id) do nothing;
 if found then
   update public.campaigns set current_views=current_views+1,qualified_users=qualified_users+1,status=case when current_views+1>=target_views then 'completed' else status end where id=c.id;
   select count(*)::integer into total_views from public.campaign_qualifications where user_id=p_user_id;

   if total_views>=50 then
     insert into public.user_view_milestones(user_id,milestone_views,reward_rupees) values(p_user_id,50,10) on conflict do nothing;
     if found then
       milestone_reward:=10; milestone_coins:=milestone_reward/0.0002;
       update public.wallets set coins=coins+milestone_coins,earnings=earnings+milestone_reward,updated_at=now() where user_id=p_user_id;
     end if;
   end if;
   if total_views>=100 then
     insert into public.user_view_milestones(user_id,milestone_views,reward_rupees) values(p_user_id,100,20) on conflict do nothing;
     if found then
       milestone_reward:=20; milestone_coins:=milestone_reward/0.0002;
       update public.wallets set coins=coins+milestone_coins,earnings=earnings+milestone_reward,updated_at=now() where user_id=p_user_id;
     end if;
   end if;
 end if;
end;
$$;

revoke all on function public.qualify_campaign_view(uuid,uuid) from public;
grant execute on function public.qualify_campaign_view(uuid,uuid) to authenticated;
