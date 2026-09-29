-- ENGAGE 008: admin-editable public information pages.
-- Additive only; existing users, wallets, content and campaigns are preserved.

create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  constraint site_pages_slug_check check (slug in ('privacy','terms','contact','about','help'))
);

insert into public.site_pages(slug,title,content) values
('privacy','Privacy Policy','ENGAGE Privacy Policy\n\nWe collect only the information needed to operate your account, wallet, campaigns and viewer rewards. We do not sell your personal information.\n\nContact support for privacy assistance.'),
('terms','Terms & Conditions','ENGAGE Terms & Conditions\n\nUse ENGAGE only for lawful promotional and viewing activity. Campaigns, rewards and coin balances are subject to the rules shown in the application.\n\nAccounts that abuse the platform may be suspended.'),
('contact','Contact Us','ENGAGE Support\n\nEmail: support@engage.app\n\nFor account, wallet, campaign or technical help, contact support with your registered email address and a short description of the issue.'),
('about','About ENGAGE','ENGAGE connects viewers and promoters in one simple platform. EARNING accounts can watch eligible content and earn coins, while PROMOTION accounts can create campaigns using coins.'),
('help','Help & Support','For login, Google sign-in, wallet, campaign or viewing issues, refresh the app and try again. If the issue continues, contact ENGAGE Support with your registered email and useful screenshots.')
on conflict(slug) do nothing;

alter table public.site_pages enable row level security;

drop policy if exists site_pages_public_read on public.site_pages;
create policy site_pages_public_read
  on public.site_pages for select
  to anon, authenticated
  using (true);

drop policy if exists site_pages_admin_insert on public.site_pages;
create policy site_pages_admin_insert
  on public.site_pages for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists site_pages_admin_update on public.site_pages;
create policy site_pages_admin_update
  on public.site_pages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.site_pages from public;
grant select on table public.site_pages to anon, authenticated;
grant insert, update on table public.site_pages to authenticated;
