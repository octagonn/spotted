# Spotted

Spotted is an Expo + React Native gym social app with a Supabase backend. It uses the provided `design/style-tile.html` and `design/demo.html` as the canonical visual reference: luxury monochrome, Boldonse display type, Geist UI type, square avatars, grain, hard hairlines, and Snapchat-style social mechanics.

## Stack

- Expo SDK 54, React Native 0.81, Expo Router v6 typed routes
- NativeWind v4, Reanimated 3, Gesture Handler
- Supabase Auth, Postgres, RLS, Storage, Realtime, Edge Functions
- Vision Camera, React Native Maps, Skia, MMKV, React Query, Zustand
- Raw APNs fan-out from `supabase/functions/send-push`

## Local Setup

1. Install dependencies:

   ```bash
   npm install --legacy-peer-deps
   ```

2. Create `.env` from `.env.example`:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   EXPO_PUBLIC_APNS_ENV=development
   EAS_PROJECT_ID=your-eas-project-id
   ```

3. Start Expo:

   ```bash
   npm run start
   ```

The app boots without Supabase credentials using local mock data. Once credentials are set, all fetches go through typed React Query hooks in `hooks/queries`.

## Supabase

Apply migrations to a fresh local Supabase project:

```bash
supabase start
supabase db reset
```

Do not run `supabase db reset --linked`. The currently linked production project also
has a known history mismatch for migrations `0006` through `0010`; read
`design/HANDOFF.md` before applying or repairing linked migrations.

Run pgTAP policy tests:

```bash
supabase test db
```

Deploy functions:

```bash
supabase functions deploy streak-tick
supabase functions deploy checkout-stale
supabase functions deploy send-push
supabase functions deploy sign-post-url
supabase functions deploy seed-gyms
supabase functions deploy iap-webhook
supabase functions deploy grant-consumable
supabase functions deploy get-post-viewers
supabase functions deploy get-friend-suggestions
supabase functions deploy avatar-process
supabase functions deploy email-auth-status
```

Required Supabase secrets:

```bash
supabase secrets set APNS_TEAM_ID=...
supabase secrets set APNS_KEY_ID=...
supabase secrets set APNS_PRIVATE_KEY=...
supabase secrets set APNS_BUNDLE_ID=com.octavio.spotted
supabase secrets set APNS_ENV=development
```

`APNS_PRIVATE_KEY` is the base64-encoded contents of the `.p8` key.

## iOS-First EAS Build From Windows

No local Mac is required. iOS is the launch target; use Expo's cloud builders:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npm run ios:build:development
npm run ios:build:preview
npm run ios:build:production
npm run ios:submit
```

An Apple Developer account is required for installable iOS builds. Use a real iPhone
with the `development` profile for an `expo-dev-client` build connected to local Metro.
Use `preview` for a standalone internal-distribution build, then `production` for the
TestFlight candidate. Camera, location, contacts, Apple Sign In, push, and sandbox IAP
must be exercised on the real device. Android remains a secondary development target.

## Checks

```bash
npm run typecheck
npm test
npm run lint
npx expo-doctor
```

Cloud EAS builds and Supabase deployments require authenticated CLI sessions and project secrets.

## Backend Notes

- `posts` media lives in the private `posts` bucket and is read via `sign-post-url`.
- Viewer access is enforced in `get-post-viewers`; free callers only receive blurred avatar paths and total count.
- `checkin` verifies distance server-side using `earthdistance`.
- Gym map presence never shares user lat/lng with friends; it only exposes active gym presence.
- Paywall placement is restricted to viewer-list, travel-mode, locked flame color, streak revival, Settings, and the day-seven push.
