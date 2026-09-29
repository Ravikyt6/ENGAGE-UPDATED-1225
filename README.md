# ENGAGE Updated UI

Mobile-first engagement/reward app using the YouTube IFrame Player API.

## Demo login
- Admin: admin@engage.app / Admin@123
- User: user@engage.app / User@123
- Creator: creator@engage.app / Creator@123
- Google button creates a demo Google user in local mode.

## Run
npm install
npm run dev

## Android
npm run build
npx cap add android
npx cap sync android
npx cap open android

## Data modes
VITE_DATA_MODE=local -> localStorage only.
VITE_DATA_MODE=supabase -> Supabase provider (SQL migrations included).

The local build does not initialize Supabase when VITE_DATA_MODE=local.
