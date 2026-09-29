# ENGAGE Supabase Production Setup

## 1. Local development
Keep:

VITE_DATA_MODE=local

Local mode stores app data in localStorage.

## 2. Supabase
Create a Supabase project and run:

supabase/001_engage_schema.sql

Then set:

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

The app starts in Local mode.

## 3. Make the app live
Login as Admin -> Admin Panel -> Settings -> DATA STORAGE MODE -> LIVE.

After LIVE is enabled, application data is read/written from Supabase instead of localStorage.

The localStorage value only remembers the runtime mode; application records are not stored there in LIVE mode.

## 4. Google Login
In Supabase Dashboard:
Authentication -> Providers -> Google

Add the Google OAuth client credentials and set the production Site URL / Redirect URL.

The frontend already calls Supabase Google OAuth when LIVE mode is enabled.

## 5. Admin
New signups are normal users.

After a user signs up, promote that profile to admin with:

update public.profiles
set role = 'admin'
where email = 'admin@example.com';

Do not expose admin role selection on public signup.

## 6. Important reward security
The browser must not be trusted for coin credit.

The SQL migrations contain the authoritative campaign spending and qualification RPCs, plus the wallet transaction ledger.

These server-side functions handle campaign spending and one-user-one-qualification.

For final production, watch-time validation should also be enforced server-side with trusted playback/session telemetry.


## Unique content viewing

`content_watch_history` guarantees one user can only watch the same content once.

Rules:
- A user's own content is hidden from Video / Shorts / Live.
- Once a content item ends, it is marked watched for that user.
- Once the campaign watch target is reached, it is also marked watched.
- Autoplay only sees eligible, un-watched content.
- In LIVE mode the history is stored in Supabase, not localStorage.
- In LOCAL mode the history is stored in localStorage under `engage_content_watch_history_v1`.

## 7. Campaign coin economy
For an existing Supabase project, run the migrations in order:

1. `supabase/001_engage_schema.sql`
2. `supabase/002_campaign_economy_and_ads.sql`
3. `supabase/003_wallet_system.sql`
4. `supabase/004_admin_user_360.sql`

Campaign creation is calculated on the server with the same economy used by the frontend:

- Reward per qualified viewer = `(required_watch_seconds / 30) * 5` coins
- Final campaign cost = `ceil(target_users * reward_per_user * internal_margin)`
- Minimum watch time = 30 seconds
- Watch time uses 30-second increments so viewer rewards remain whole coins
- Creator balance is checked and charged only inside the successful campaign creation transaction
- `creation_request_id` prevents duplicate charges from repeated submissions
- Creator content cannot qualify its creator as a viewer

The creator UI displays only the final campaign cost; the internal platform margin is already included in that amount.

## 9. Wallet ledger
`supabase/003_wallet_system.sql` adds `wallet_transactions` and removes normal-user direct wallet balance updates. Campaign spending and viewer rewards are recorded atomically with the wallet balance change. The Wallet page reads this ledger from Supabase. The Admin Users section uses server-side User 360 RPCs for paginated user details, campaign history, transaction history, withdrawals, activity timeline, and audited admin actions.

Normal users cannot insert, update, or delete wallet transactions directly. Coin purchases should be credited by a trusted payment/backend flow, not by a browser-side balance update.

## 8. Advertisement settings
Admin -> Settings contains separate controls for:

- Playback advertisement enable/disable
- Advertisement popup interval
- Advertisement on watch target / video end
- Social Bar advertisement
- User autoplay

These settings are stored through the active data provider and can be switched from Local development storage to Supabase Live storage from the same Settings page.


### Monetag MultiTag
For an existing database, run `supabase/migrations/005_monetag_multitag.sql`. Then use Admin → Settings → Advertisement Controls to enable/disable Monetag MultiTag.
