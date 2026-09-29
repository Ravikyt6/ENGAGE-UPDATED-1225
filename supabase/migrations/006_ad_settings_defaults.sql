-- ENGAGE 006: ensure all ad settings exist and default to OFF.
-- Run after 005_ads_and_admin_rpc_fix.sql.
-- Existing migrations are intentionally left unchanged.

alter table public.app_settings
  add column if not exists high_revenue_banner_enabled boolean not null default false;

alter table public.app_settings
  add column if not exists profitabler_square_enabled boolean not null default false;

insert into public.app_settings(id)
values (1)
on conflict (id) do nothing;

update public.app_settings
set high_revenue_banner_enabled = false,
    profitabler_square_enabled = false,
    updated_at = now()
where id = 1;
