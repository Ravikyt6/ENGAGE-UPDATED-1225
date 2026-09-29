-- ENGAGE compatibility + admin ads controls
-- Safe to run on the current database. Does not delete existing user/campaign data.

-- -----------------------------------------------------------------------------
-- Profile compatibility for databases created from the earlier migrations.
-- The current application uses `name` and account status.
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists avatar_url text;
update public.profiles set name=coalesce(nullif(name,''),'User') where name is null or name='';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','suspended','banned'));

-- -----------------------------------------------------------------------------
-- Settings table compatibility. The application reads/writes app_settings.
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id integer primary key default 1,
  reward_per_user numeric(18,4) not null default 0,
  campaign_creation_cost numeric(18,4) not null default 0,
  autoplay_enabled boolean not null default true,
  ad_enabled boolean not null default false,
  social_bar_enabled boolean not null default false,
  high_revenue_banner_enabled boolean not null default false,
  profitabler_square_enabled boolean not null default false,
  monetag_multitag_enabled boolean not null default false,
  monetag_vignette_enabled boolean not null default false,
  monetag_push_created_enabled boolean not null default false,
  monetag_in_page_push_enabled boolean not null default false,
  ad_interval_seconds integer not null default 15,
  show_ad_on_end boolean not null default false,
  min_short_seconds integer not null default 1,
  max_short_seconds integer not null default 59,
  viewer_reward_usd_per_coin numeric(18,8) not null default 0.0002,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values(1) on conflict(id) do nothing;
alter table public.app_settings add column if not exists social_bar_enabled boolean not null default false;
alter table public.app_settings add column if not exists high_revenue_banner_enabled boolean not null default false;
alter table public.app_settings add column if not exists profitabler_square_enabled boolean not null default false;
alter table public.app_settings add column if not exists monetag_multitag_enabled boolean not null default false;
alter table public.app_settings add column if not exists monetag_vignette_enabled boolean not null default false;
alter table public.app_settings add column if not exists monetag_push_created_enabled boolean not null default false;
alter table public.app_settings add column if not exists monetag_in_page_push_enabled boolean not null default false;
alter table public.app_settings add column if not exists viewer_reward_usd_per_coin numeric(18,8) not null default 0.0002;

-- -----------------------------------------------------------------------------
-- Wallet ledger compatibility used by the Admin Users 360 RPCs.
-- -----------------------------------------------------------------------------
alter table public.wallet_transactions add column if not exists coins numeric(18,4);
alter table public.wallet_transactions add column if not exists balance_after numeric(18,4);
alter table public.wallet_transactions add column if not exists description text;
-- Current wallet ledger already uses `coins` and `description`.
-- Do not reference the obsolete `amount` column.
update public.wallet_transactions
set description = coalesce(nullif(description,''), type)
where description is null or description = '';

-- -----------------------------------------------------------------------------
-- Authoritative admin user list RPC. Recreate it against the current schema so
-- the browser RPC call and PostgREST signature always match.
-- -----------------------------------------------------------------------------
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
language plpgsql
security definer
set search_path=public
as $$
declare
  off integer := greatest(coalesce(p_page,1)-1,0) * least(greatest(coalesce(p_page_size,20),1),100);
  lim integer := least(greatest(coalesce(p_page_size,20),1),100);
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  return query
  with base as (
    select
      p.id,
      p.email,
      coalesce(p.name, 'User') as display_name,
      p.avatar_url,
      p.role,
      coalesce(p.status,'active') as account_status,
      p.created_at,
      au.email_confirmed_at,
      greatest(
        p.created_at,
        coalesce(au.last_sign_in_at,p.created_at),
        coalesce((select max(wt.created_at) from public.wallet_transactions wt where wt.user_id=p.id),p.created_at),
        coalesce((select max(c.created_at) from public.campaigns c where c.creator_id=p.id),p.created_at)
      ) as last_active,
      coalesce((select w.coins from public.wallets w where w.user_id=p.id),0) as balance
    from public.profiles p
    left join auth.users au on au.id=p.id
    where (
      coalesce(p_search,'')='' or
      coalesce(p.name,'') ilike '%'||p_search||'%' or
      coalesce(p.email,'') ilike '%'||p_search||'%' or
      p.id::text ilike '%'||p_search||'%'
    )
    and (coalesce(p_status,'')='' or coalesce(p.status,'active')=p_status)
  )
  select b.id,b.email,b.display_name,b.avatar_url,b.role,b.account_status,b.created_at,
         (b.email_confirmed_at is not null),b.last_active,b.balance,count(*) over()::bigint
  from base b
  order by b.created_at desc
  offset off limit lim;
end;
$$;
revoke all on function public.admin_list_users(integer,integer,text,text) from public;
grant execute on function public.admin_list_users(integer,integer,text,text) to authenticated;

-- Keep app settings readable/writable through the existing admin-only flow.
alter table public.app_settings enable row level security;
drop policy if exists app_settings_read_authenticated on public.app_settings;
create policy app_settings_read_authenticated on public.app_settings for select to authenticated using (true);
drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Start with every advertisement disabled. Admin can enable providers later.
update public.app_settings
set ad_enabled=false, social_bar_enabled=false, high_revenue_banner_enabled=false, profitabler_square_enabled=false, monetag_multitag_enabled=false,
    monetag_vignette_enabled=false, monetag_push_created_enabled=false,
    monetag_in_page_push_enabled=false, show_ad_on_end=false, updated_at=now()
where id=1;
