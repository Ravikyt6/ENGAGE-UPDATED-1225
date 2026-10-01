-- Admin package management.
-- campaign_packages already has admin INSERT/UPDATE/DELETE RLS policies from 018.
-- This migration refreshes the updated_at trigger behavior so admin edits are timestamped.

create or replace function public.touch_campaign_package_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_packages_updated_at on public.campaign_packages;
create trigger trg_campaign_packages_updated_at
before update on public.campaign_packages
for each row execute function public.touch_campaign_package_updated_at();
