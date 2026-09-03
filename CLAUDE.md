# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotted is a **live, production iOS** gym social app (Snapchat-style "pump drops" with daily streaks, gym
geofencing, friend stories, workouts, trophies, communities and chat) backed by Supabase. Real users; do not
rebuild — iterate. The UI is a premium dark monochrome system with one warm gold accent (`#E8B44C`),
Boldonse display + Geist UI typography, and a subtle global grain overlay.

**`package.json` is authoritative for versions.** As of 2026-08-28: Expo SDK 54 (`expo ~54.0.36`),
React Native 0.81.5, React 19.1, Expo Router 6 (typed routes), NativeWind 4.2 + Tailwind 3.4,
Reanimated 4.1 + `react-native-worklets`, Gesture Handler 2.28, FlashList 2.0, Expo Image 3, Expo Video /
Audio, Gorhom Bottom Sheet 5, Vision Camera 4.7 + Expo Camera 17, React Native Maps 1.20, Shopify Skia 2.2,
MMKV 3.3, React Query 5.90 (+ persist), Zustand 5, Supabase JS 2.86, Lucide 0.468, Expo Haptics / Blur /
Linear Gradient, `expo-glass-effect` (optional, probed at runtime). Older docs mentioning Expo 52 / RN 0.76 /
Router v4 are stale.

## Common Commands

Install (peer deps require the legacy resolver):

```bash
npm install --legacy-peer-deps
```

Day-to-day:

```bash
npm run start         # expo start
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

EAS cloud builds (see `eas.json`; `npm run ios:build:{development,preview,production}`, `npm run ios:submit`).

## Environment

`.env` is loaded by Expo via `app.config.ts` and exposed through `Constants.expoConfig.extra`. Without
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` the client falls back to `lib/mockData.ts` so the
app boots — `lib/supabase.ts` exports `isSupabaseConfigured` for branching. `EXPO_PUBLIC_APNS_ENV` and
`EAS_PROJECT_ID` are also threaded through `extra`.

Path alias `@/*` maps to the repo root (configured in both `tsconfig.json` and `vitest.config.ts`).

## Architecture

### Routing (Expo Router 6, typed routes enabled)

`app/_layout.tsx` is the root and owns the global systems — do not restructure it for UI reasons. It mounts,
outer → inner: `GestureHandlerRootView` → `PersistQueryClientProvider` (persisted React Query, 30s staleTime,
retry 1 — `lib/queryClient.ts`) → `ThemeProvider` (dark only) → `AppServices` (realtime, push, presence/geofence
sync, `AnalyticsConsentHost`, `PolicyUpdateNotice`, `JoinGymCommunityPrompt`) + `SessionGuard` → `SheetProvider`
→ `DismissKeyboard` → `AmbientFlowBackground` → `Stack`. Overlay hosts after the Stack: `ZoomPreviewHost`,
`AppDialogHost`, `ToastHost`, `NotificationBanner`, `TrophyEarnHost`, `PushPrimingHost`, `GrainOverlay`,
`FlashOverlay`, `PostCelebration`, `StatusBar`. Fonts: Boldonse, Anton, Geist 400/500/600/700, Geist Mono 400/500.

Route groups:

- `app/(auth)` — welcome, sign-in, email
- `app/(onboarding)` — birthday, create-profile, profile-photo, home-gym, permissions, privacy, blocked
- `app/(tabs)` — feed, friends, map, profile. `app/(tabs)/_layout.tsx` is a Material Top Tabs navigator
  (`react-native-pager-view`, bar at the bottom) so pages swipe under the finger; custom `GlassTabBar`:
  Home · Friends · **Camera (center action → pushes `/camera`)** · Map · Profile. The camera is an action, not a tab.
  Do not add hidden/redirect routes inside `(tabs)` — a custom navigator does not honor `href: null`, they would become pages.
- Camera: `app/camera.tsx` (Expo Camera; the old `screens/CameraScreen.*` Vision Camera files were dead and deleted 2026-08-28) with its compose sheets in `components/camera/*`.
- Top-level routes: `camera`, `chat-camera`, `story`, `workout`, `workout/[id]`, `workout/select`, `my-workouts`,
  `inbox`, `message-requests`, `pending-requests`, `chat/[id]`, `chat-details/[id]`, `user/[username]`, `gym/[id]`,
  `post/[id]`, `profile-posts/[postId]`, `tagged-posts/[postId]`, `profile-section/[section]`, `daily/[date]`,
  `trophy/[id]`, `achievement/[id]`, `community/[id]/{index,members,roles,settings}`, `community-new`, `drafts`,
  `edit-profile`, `people/[type]`, `settings/*`, `modal`.

`app/index.tsx` redirects into the app. The app is dark-mode only (`userInterfaceStyle: "dark"`).

### Data layer

- `lib/supabase.ts` is the single Supabase client (typed via `types/database.ts`).
- All server reads go through `hooks/queries/*` (React Query). When `isSupabaseConfigured` is false these hooks
  fall back to `lib/mockData.ts`.
- Global non-server state lives in `stores/*` (Zustand): `auth`, `audio`, `banner`, `camera`, `pendingPosts`,
  `presence`, `relationships`, `tabActions`, `theme`, `ui`, `workoutSession`.
- Domain shapes live in `types/domain.ts`; the auto-generated DB schema lives in `types/database.ts`.
- Workout behavior foundation: `stores/workoutSession.ts`, `hooks/queries/useWorkouts.ts`, `lib/workoutLibrary.ts`.

### Native vs web

Several modules have `.native.tsx` / `.tsx` (web) splits — Metro picks the platform variant automatically:
`components/GrainOverlay.{native,web}.tsx`, `components/map/MapCanvas.native.tsx` (MapLibre GL in a WebView — react-native-maps crashed under the New Architecture), `hooks/use-color-scheme.{ts,web.ts}`. When adding camera, maps, Skia, or
MMKV usage, gate it through a `.native` variant and provide a web stub — the web bundle must keep building.

### Styling

NativeWind 4 + Tailwind 3. **Single source of truth: `theme/palette.json`** (colors, status colors, radius,
spacing). `theme/colors.ts` and `theme/tokens.ts` re-export/alias it; `tailwind.config.js` derives its colors and
`rounded-sm/md/lg/pill` from the same JSON. `tests/theme.test.ts` fails if they drift. Text variants live in
`theme/typography.ts` (consumed by `components/ui/Text`); motion in `theme/motion.ts`. `global.css` is imported
once from `app/_layout.tsx`. Full system: `docs/DESIGN_SYSTEM.md`. Do not upgrade to NativeWind 5.

### Supabase backend (`supabase/`)

- Migrations `0001`–`0005` cover init schema, RLS, functions/triggers, monetization, social signals. `0006`–`0010`
  (2026-07-03) add security hardening (search_path pins, anon EXECUTE revokes), RLS performance rewrites
  (`(select auth.uid())`), pg_cron sweeps (`streak_tick_sweep`, `checkout_stale_sweep`), pg_net webhooks
  (notifications → `send-push`, avatar upload → `avatar-process`), and a unique conversation-pair index. Later
  timestamped migrations add communities, trophies (engine v3), avatars on R2, etc. See `docs/PRODUCTION.md`.
- pgTAP RLS tests in `supabase/tests/` — run with `supabase test db`.
- Edge Functions (Deno, excluded from the app TS project — see `tsconfig.json` excludes and `eslint.config.js`
  ignores): `send-push` (raw APNs fan-out; `APNS_*` secrets), `sign-post-url` (signed URLs for the private
  `posts` bucket), `get-post-viewers` (free callers get blurred avatars + count — paywall enforced server-side),
  `iap-webhook` (verifies Apple JWS x5c chain; deploy with `--no-verify-jwt`), `grant-consumable`,
  `delete-account`, `seed-gyms`, `get-friend-suggestions`, `avatar-process`, `r2-media`, `export-data`,
  `link-apple-identity`, `refresh-music-chart`, plus legacy `streak-tick` / `checkout-stale` (superseded by SQL).
- `_shared/` is imported by multiple functions (`http.ts`, `push.ts`, `supabase.ts`). Deploy each function explicitly.

### Backend invariants (do not violate)

- `posts` media is in the **private** `posts` bucket — always go through `sign-post-url`.
- `get-post-viewers` is the only path to the viewer list; free tier gets blurred avatars + count.
- `checkin` distance is verified server-side using the `earthdistance` extension — do not trust client geofence
  checks for state-changing writes.
- The gym map shows gym presence only; never expose user lat/lng to friends.
- Paywall surfaces are restricted to: viewer-list, travel-mode, locked flame color, streak revival, Settings,
  day-seven push. Don't add new gates.
- Do not weaken RLS, auth, or authorization to simplify UI queries.

## Testing

Vitest runs in node env over `tests/**/*.test.ts` (23 suites, pure `lib/*` logic + `tests/theme.test.ts`). Push
new logic into `lib/*` so it can be unit-tested without React Native — UI components and Expo-only modules are
not mocked for the test runner.

## Mobile / RN skills (auto-apply)

Invoke via the Skill tool when relevant: `react-native-skills` (FlashList over FlatList, `expo-image` over
`Image`, Pressable over Touchable\*, animate only `transform`/`opacity` on the UI thread), `mobile-first-design`,
`mobile-app-debugging`, `mobile-app-testing`, `mobile-offline-support`, `push-notification-setup` (this project
uses raw APNs, not FCM), `app-store-deployment`.

## Tooling notes

- TypeScript is `strict`. Legacy Expo template files (`components/{themed-text,themed-view,parallax-scroll-view,
haptic-tab,hello-wave,external-link}.tsx`, `components/ui/{collapsible,icon-symbol*}.tsx`, `constants/**`,
  `hooks/use-color-scheme*.ts`) are excluded in `tsconfig.json` / `eslint.config.js` — leave them excluded; they are
  scheduled for deletion in the final V2 pass.
- `supabase/functions/**` is excluded from the app TS/lint config because it runs under Deno.
- Windows: Metro blocks `@tybys`/`@napi-rs` in `metro.config.js` (watcher crash on optional deps). Line endings are
  CRLF on disk with `core.autocrlf`; the LF→CRLF warnings are expected.

---

# Spotted V2 UI — Persistent Rules

## Current frontend stack

Treat `package.json` as authoritative. Spotted currently uses Expo SDK 54, React Native 0.81, Expo Router 6,
NativeWind 4, Reanimated 4, FlashList 2, Expo Image, Gorhom Bottom Sheet 5, React Query 5, Zustand 5 and Supabase.
Do not rely on stale version references elsewhere.

## Design identity

Spotted is a premium dark social-fitness product. Preserve the black / near-black / white / gray palette and the
warm Spotted gold (`#E8B44C`). Do not introduce arbitrary brand accents. The old `design/*` mockups
(`REDESIGN-SPEC.md`, `redesign.html`, `style-tile.html`, 393×852 assumptions) are historical references, not the
authority for the V2 redesign. The current implementation source of truth is:

- `theme/*` (`palette.json` → `colors.ts` / `tokens.ts` → `tailwind.config.js`)
- `components/ui/*`
- `docs/DESIGN_SYSTEM.md`
  Progress and global decisions: `docs/UI_REDESIGN_STATUS.md`.

## Reuse-first rule

Before creating a component:

1. Search `components/ui`.
2. Search the relevant domain component directory (`components/post|profile|workout|trophies|friends|map|camera|chat|communities|settings|story`).
3. Search the repository.
4. Reuse an existing component when appropriate.
5. Extend it only when the behavior is genuinely shared.
6. Create a new reusable component only when needed.
   Never build a duplicate primitive directly inside a screen. Do not over-abstract trivial layout.
   Known: there is no `GlassCard`; `components/workout/GlassSurface.tsx` is the only glass container.

## Tokens

Do not introduce arbitrary colors, spacing, radii, typography or motion when an existing token can express the
design. Every hex/radius/space value is defined once in `theme/palette.json`; `tests/theme.test.ts` enforces sync
with Tailwind. Screens consume `tokens.bg/text/border/accent/status.*` over raw `colors.*`. Spacing is a 4pt
rhythm (4/8/12/16/24/32/40/48); radii are `sm 12 / md 16 / lg 24 / pill`.

## Typography

Use Boldonse sparingly for branding/display. Use Geist for general UI. Use Geist Mono intentionally for
stats/timers/fitness metadata. Use `components/ui/Text` with `theme/typography.ts` variants — never inline
`fontFamily`. `ui/Text` has `style?: never`; color overrides go through `className`. The only sanctioned raw RN `Text`
usages are data-driven colors (role colors, medal tints) — see `docs/DESIGN_SYSTEM.md` §20. `theme/tokens.ts`
`typeScale` is deprecated; do not add consumers.

## Components

Prefer owned Spotted primitives over installing another component library. Do not introduce a new UI framework
(Reusables, Tamagui, Gluestack, Paper, …) without explicit approval. Use the existing global `SheetProvider` /
`useSheet()` for standard bottom sheets. Use the existing Expo Image / `CachedImage` system. Use FlashList where
virtualization is warranted. Use Lucide consistently with `icon.size` / `icon.stroke` from `theme/tokens.ts` —
no `expo-symbols` migration unless explicitly approved. Use `appAlert()` (`AppDialog`), never `Alert.alert`.
People in lists → `UserRow`; boxed inputs → `TextField`; icon actions → `IconButton`; settings rows → the
`SettingRow` family (`SettingChoice` for inline pills); destructive actions → `Button variant="danger"` /
`"danger-solid"` (one per screen); empty states → `EmptyState`; section eyebrows → `SectionLabel`. Domain index
in `docs/DESIGN_SYSTEM.md` §22.

## Motion

Use `theme/motion.ts` (`easing.*`, `durations.*`, `springs.snappy|gentle|bouncy`). Avoid arbitrary durations and
springs. Favor transform + opacity. Keep animation work off the JS thread where possible. Honor reduced motion.
Do not casually wrap the shared `Pressable` with Reanimated: a previous animated-wrapper implementation broke
NativeWind `className` behavior on device.

## Haptics

Haptics are semantic feedback, not a default decoration. `Pressable` accepts
`haptic="none" | "selection" | "impact" | "success" | "warning"` (booleans are legacy). Use them intentionally
for selections, meaningful impacts and successful actions. Import from `@/lib/haptics`, never `expo-haptics`
directly. The `Pressable` default is still `true` (selection) for compatibility; it flips to `"none"` once every
major screen sets explicit kinds.

## Visual restraint

Avoid excessive cards, pills, borders, blur, glass, gradients, shadows, glow and decorative animation. No card
inside card. Use spacing, typography and content hierarchy before adding containers. Keep the grain subtle.

## Production safety

Spotted is already live. A redesign must not silently alter authentication, Supabase queries, RLS, database
behavior, realtime, notifications, signed post media, geofence/check-in security, subscriptions/paywalls, routing,
or existing feature functionality. Inventory every interaction before redesigning a screen and re-verify it after.

## Location security

Never expose raw user latitude/longitude. Gym presence remains gym-level. Server-side check-in verification remains
authoritative.

## Platform rules

Respect existing `.native.tsx` / web split files. Do not introduce native imports that break the web bundle.

## Screen workflow

Redesign one major screen at a time. For each screen:

1. Audit. 2. Inventory functionality. 3. Find reuse opportunities. 4. Identify duplication. 5. Explain design intent.
2. Implement. 7. Verify `npm run typecheck`, `npm run lint`, `npm test`. 8. Verify interaction states.
3. Verify performance. 10. Update `docs/UI_REDESIGN_STATUS.md` (and `docs/DESIGN_SYSTEM.md` for global decisions). 11. Stop.
   Never automatically redesign the next major page — wait for "Begin Phase N".

## Quality bar

Spotted should feel premium, dark, social, athletic, confident, native, photography-first, fast and cohesive. It
should not feel vibe-coded or AI-generated. When uncertain, simplify.
