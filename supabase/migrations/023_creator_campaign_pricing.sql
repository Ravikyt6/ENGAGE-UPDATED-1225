-- Direct creator campaign pricing.
-- Admin controls a fixed price per requested view and per required watch second.
-- Campaign cost = views * price_per_view + (views * watch_seconds_per_user) * price_per_second.

alter table public.app_settings
  add column if not exists campaign_price_per_view numeric(18,6) not null default 0,
  add column if not exists campaign_price_per_second numeric(18,9) not null default 0.026666667;

-- Keep historical campaign records, but move their displayed cost to a neutral field.
alter table public.campaigns
  add column if not exists campaign_cost numeric(18,2) not null default 0,
  add column if not exists watch_seconds_per_user integer;

update public.campaigns
set campaign_cost = case when campaign_cost = 0 then coalesce(package_price, 0) else campaign_cost end,
    watch_seconds_per_user = coalesce(watch_seconds_per_user, required_watch_seconds);

-- Package purchasing/balance is retired. Remove the old package creation functions.
drop function if exists public.create_campaign_with_package(text,uuid,uuid,text,text,uuid);
drop function if exists public.create_campaign_from_package_balance(text,uuid,uuid,text,text,integer,numeric);
drop function if exists public.credit_creator_package(uuid,uuid,text);

-- Direct campaign creation. Pricing is read from app_settings so creators cannot change rates.
drop function if exists public.create_campaign_with_pricing(text,uuid,uuid,text,text,integer,integer);
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

  if p_type = 'shorts' and p_watch_seconds >= 60 then
    raise exception 'Shorts campaigns need less than 60 seconds per view';
  end if;

  if p_content_id is not null then
    select duration_seconds into content_duration from public.contents where id = p_content_id;
    if p_type = 'shorts' and coalesce(content_duration,0) >= 60 then
      raise exception 'This content is 60 seconds or longer and is not eligible as a Short';
    end if;
  end if;

  select campaign_price_per_view, campaign_price_per_second
    into rate_per_view, rate_per_second
  from public.app_settings where id = 1;

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

-- Retire package-only tables after the direct pricing model is installed.
drop table if exists public.creator_package_purchases cascade;
drop table if exists public.creator_package_wallets cascade;
drop table if exists public.campaign_packages cascade;

-- Package metadata is no longer used by campaigns.
alter table public.campaigns
  drop constraint if exists campaigns_package_id_fkey,
  drop column if exists package_id,
  drop column if exists package_name,
  drop column if exists package_price;

-- Keep the milestone/reward wallet system intact.
