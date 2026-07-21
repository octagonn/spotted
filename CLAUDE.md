# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotted is an Expo SDK 52 + React Native 0.76 gym social app (Snapchat-style "pump drops" with daily streaks, gym geofencing, and friend stories) backed by Supabase. The product visual reference is canonical and lives at `design/style-tile.html` and `design/demo.html` — luxury monochrome, Boldonse display + Geist UI typography, square avatars, grain overlay, hard hairlines.

## Common Commands

Install (peer deps require the legacy resolver):

```bash
npm install --legacy-peer-deps
```

Day-to-day:

```bash
npm run start         # expo start
npm run android       # expo start --android
npm run ios           # expo start --ios
npm run web           # expo start --web (boots without Supabase using mock data)
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint (eslint-config-expo)
npm test              # vitest run (node env, only tests/**/*.test.ts)
npm run format        # prettier --check .
npx expo-doctor
```

Run a single test file or filter by name:

```bash
npx vitest run tests/paywall.test.ts
npx vitest run -t "grants viewer access"
```

EAS cloud builds (no local Mac required, see `eas.json`):

```bash
npx eas login
npx eas build --platform ios --profile preview
npx eas build --platform android --profile preview
```

## Environment

`.env` is loaded by Expo via `app.config.ts` and exposed through `Constants.expoConfig.extra`. Without `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` the client falls back to `lib/mockData.ts` so the app boots — `lib/supabase.ts` exports `isSupabaseConfigured` for branching. `EXPO_PUBLIC_APNS_ENV` and `EAS_PROJECT_ID` are also threaded through `extra`.

Path alias `@/*` maps to the repo root (configured in both `tsconfig.json` and `vitest.config.ts`).

## Architecture

### Routing (Expo Router v4, typed routes enabled)

`app/_layout.tsx` is the root: it loads Boldonse + Geist fonts, wires `QueryClientProvider` (30s default staleTime, retry: 1), `GestureHandlerRootView`, the `GrainOverlay`, and a dark-only `ThemeProvider`. The Stack composes route groups:

- `app/(auth)` — welcome, sign-in
- `app/(onboarding)` — create-profile, home-gym, permissions, schedule
- `app/(tabs)` — feed, map, camera, friends, explore, profile
- Modals: `post/[id]`, `gym/[id]`, `streak`, `paywall`
- `user/[username]`, `chat/[id]`

`app/index.tsx` redirects to `/feed`. The app is dark-mode only (`userInterfaceStyle: "dark"` in `app.config.ts`).

### Data layer

- `lib/supabase.ts` is the single Supabase client (typed via `types/database.ts`). It uses AsyncStorage on native and disables session persistence under SSR (`Platform.OS === "web" && typeof window === "undefined"`).
- All server reads go through `hooks/queries/*` (React Query). When `isSupabaseConfigured` is false these hooks fall back to `lib/mockData.ts` so screens stay functional offline.
- Global non-server state lives in `stores/*` (Zustand): `auth`, `presence`, `subscription`, `theme`.
- Domain shapes live in `types/domain.ts`; the auto-generated DB schema lives in `types/database.ts`.

### Native vs web

Several modules have `.native.tsx` / `.tsx` (web) splits — Metro picks the platform variant automatically. Examples: `components/GrainOverlay.{native,web}.tsx`, `components/StreakFlame.native.tsx`, `screens/CameraScreen.native.tsx`, `screens/GymMapScreen.native.tsx`, `hooks/use-color-scheme.{ts,web.ts}`. When adding camera, maps, Skia, or MMKV usage, gate it through a `.native` variant and provide a web stub — the web bundle must keep building.

### Styling

NativeWind v4 + Tailwind. The custom token palette (`black` → `pure` greyscale) is defined identically in `tailwind.config.js` and `theme/colors.ts` — keep them in sync. Custom `borderRadius.spotted` (8px), `borderRadius.sheet` (16px), and font families `display` (Boldonse), `sans*` (Geist) are the design-tile primitives. `global.css` is imported once from `app/_layout.tsx`.

### Supabase backend (`supabase/`)

- Migrations `0001`–`0005` cover init schema, RLS, functions/triggers, monetization, social signals. `0006`–`0010` (2026-07-03) add security hardening (search_path pins, anon EXECUTE revokes), RLS performance rewrites (`(select auth.uid())`), pg_cron sweeps (`streak_tick_sweep`, `checkout_stale_sweep` — the streak-tick/checkout-stale edge functions are superseded by SQL), pg_net webhooks (notifications → `send-push`, avatar upload → `avatar-process`), and a unique conversation-pair index. See `docs/PRODUCTION.md` for the full launch state.
- pgTAP RLS tests in `supabase/tests/` — run with `supabase test db`.
- Edge Functions (Deno, excluded from the app TS project — see `tsconfig.json` excludes and `eslint.config.js` ignores):
  - `streak-tick` (cron — daily streak rollover)
  - `checkout-stale` (cron — clear stale gym presence)
  - `send-push` (raw APNs fan-out; needs `APNS_TEAM_ID`/`APNS_KEY_ID`/`APNS_PRIVATE_KEY` (base64 `.p8`)/`APNS_BUNDLE_ID`/`APNS_ENV` secrets)
  - `sign-post-url` (signed URLs for the private `posts` bucket)
  - `get-post-viewers` (free callers receive blurred avatar paths + count only — paywall enforced server-side)
  - `iap-webhook` (verifies Apple JWS x5c chain against pinned Apple Root CA-G3; deploy with `--no-verify-jwt`), `grant-consumable`
  - `delete-account` (auth user + storage wipe; App Store account-deletion requirement)
  - `seed-gyms`, `get-friend-suggestions`, `avatar-process`
- `_shared/` is imported by multiple functions (`http.ts`, `push.ts`, `supabase.ts`).
- Deploy each function explicitly (see README for the full list).

### Backend invariants (do not violate)

- `posts` media is in the **private** `posts` bucket — always go through `sign-post-url`.
- `get-post-viewers` is the only path to the viewer list; free tier gets blurred avatars + count.
- `checkin` distance is verified server-side using the `earthdistance` extension — do not trust client geofence checks for state-changing writes.
- The gym map shows gym presence only; never expose user lat/lng to friends.
- Paywall surfaces are restricted to: viewer-list, travel-mode, locked flame color, streak revival, Settings, day-seven push. Don't add new gates.

## Testing

Vitest runs in node env over `tests/**/*.test.ts`. Existing suites cover pure logic modules: `friendship`, `geofence`, `paywall`, `pushPayload`, `subscription`. Push new logic into `lib/*` so it can be unit-tested without React Native — UI components and Expo-only modules are not currently mocked for the test runner.

## Mobile / RN skills (auto-apply)

This is an Expo + React Native codebase, so these globally-installed skills are in scope and should be invoked via the Skill tool when relevant:

- `react-native-skills` — RN/Expo rule library (list perf, animation, navigation, UI patterns). Apply before adding lists, animations, or new screens. Hard preferences from this skill that match the codebase: FlashList over FlatList, `expo-image` over `Image`, Pressable over Touchable*, native stack/tabs, animate only `transform`/`opacity` on the UI thread.
- `mobile-first-design` — for any responsive layout decision (web export uses `react-native-web`).
- `mobile-app-debugging` — RN/native crashes, bridge errors, Reanimated/Skia issues, Metro problems.
- `mobile-app-testing` — extending the Vitest suites or adding Detox/Maestro E2E.
- `mobile-offline-support` — when touching MMKV/AsyncStorage, presence sync, or React Query offline behavior.
- `push-notification-setup` — when changing the APNs path (`supabase/functions/send-push`, `lib/pushPayload.ts`, `expo-notifications` wiring). Note: this project uses raw APNs from the Edge Function, not FCM — adapt the skill's FCM guidance accordingly.
- `app-store-deployment` — when working with `eas.json`, build profiles, or release prep.

## Tooling notes

- TypeScript is `strict`. The legacy Expo template files under `components/` and `components/ui/` (themed-text, themed-view, parallax-scroll-view, icon-symbol, etc.) are listed in `tsconfig.json` excludes and `eslint.config.js` ignores — leave them excluded; the new app code uses `components/ui/{Avatar,Button,Chip,Pressable,Sheet,Skeleton,Text}.tsx` instead.
- `supabase/functions/**` is excluded from the app TS/lint config because it runs under Deno.
- `scripts/reset-project.js` is the Expo template's project-reset script — not part of normal workflow.
