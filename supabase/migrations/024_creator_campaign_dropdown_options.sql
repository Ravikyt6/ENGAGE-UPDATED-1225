-- Admin-controlled dropdown options for creator campaign targets.
-- Creators select from these values instead of typing arbitrary view/watch targets.

alter table public.app_settings
  add column if not exists campaign_view_options integer[] not null default array[10,25,50,100,250,500,1000],
  add column if not exists campaign_watch_second_options integer[] not null default array[15,30,45,60];

update public.app_settings
set campaign_view_options = array[10,25,50,100,250,500,1000]
where id = 1 and (campaign_view_options is null or cardinality(campaign_view_options) = 0);

update public.app_settings
set campaign_watch_second_options = array[15,30,45,60]
where id = 1 and (campaign_watch_second_options is null or cardinality(campaign_watch_second_options) = 0);

create or replace function public.create_campaign_with_pricing(
  p_creation_request_id text,
  p_creator_id uuid,
  p_content_id uuid,
  p_title text,
  p_type text,
  p_target_views integer,
  p_watch_seconds integer
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.campaigns%rowtype;
  existing public.campaigns%rowtype;
  creator_role text;
  creator_account_type text;
  content_duration integer;
  rate_per_view numeric;
  rate_per_second numeric;
  total_cost numeric;
  allowed_views integer[];
  allowed_watch_seconds integer[];
begin
  if auth.uid() is null or auth.uid() <> p_creator_id then raise exception 'Unauthorized'; end if;
  if p_target_views < 1 then raise exception 'Enter at least 1 view'; end if;
  if p_watch_seconds < 1 then raise exception 'Enter watch time per user'; end if;
  if p_type not in ('video','shorts','live') then raise exception 'Invalid campaign type'; end if;

  select role, account_type into creator_role, creator_account_type
  from public.profiles where id = p_creator_id;

  if coalesce(creator_role,'') not in ('admin','creator')
     and coalesce(creator_account_type,'') <> 'promotion' then
    raise exception 'Only creator/promotion accounts can create campaigns';
  end if;

  select * into existing from public.campaigns
  where creation_request_id = p_creation_request_id limit 1;
  if found then return existing; end if;

  select campaign_price_per_view,
         campaign_price_per_second,
         coalesce(campaign_view_options, array[10,25,50,100,250,500,1000]),
         coalesce(campaign_watch_second_options, array[15,30,45,60])
    into rate_per_view, rate_per_second, allowed_views, allowed_watch_seconds
  from public.app_settings where id = 1;

  if not (p_target_views = any(allowed_views)) then
    raise exception 'Select a valid number of views from the Admin options';
  end if;

  if not (p_watch_seconds = any(allowed_watch_seconds)) then
    raise exception 'Select a valid watch time from the Admin options';
  end if;

  if p_type = 'shorts' and p_watch_seconds >= 60 then
    raise exception 'Shorts campaigns need less than 60 seconds per view';
  end if;

  if p_content_id is not null then
    select duration_seconds into content_duration from public.contents where id = p_content_id;
    if p_type = 'shorts' and coalesce(content_duration,0) >= 60 then
      raise exception 'This content is 60 seconds or longer and is not eligible as a Short';
    end if;
  end if;

  rate_per_view := greatest(coalesce(rate_per_view,0),0);
  rate_per_second := greatest(coalesce(rate_per_second,0),0);
  total_cost := round(
    p_target_views * rate_per_view
    + (p_target_views::numeric * p_watch_seconds::numeric) * rate_per_second,
    2
  );

  if total_cost <= 0 then
    raise exception 'Campaign pricing is not configured by admin yet';
  end if;

  insert into public.campaigns(
    creator_id, content_id, title, type, target_views,
    required_watch_seconds, total_watch_minutes, campaign_cost,
    creation_request_id
  )
  values(
    p_creator_id, p_content_id, p_title, p_type, p_target_views,
    p_watch_seconds, round((p_target_views::numeric * p_watch_seconds) / 60.0, 2),
    total_cost, p_creation_request_id
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_campaign_with_pricing(text,uuid,uuid,text,text,integer,integer) from public;
grant execute on function public.create_campaign_with_pricing(text,uuid,uuid,text,text,integer,integer) to authenticated;
