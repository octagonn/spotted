# Spotted — Production Roadmap

_Last updated: 2026-07-14. State after the production-hardening and iOS launch-readiness sessions._

## Launch target: iOS first

TestFlight and App Store submission are the launch path. A production iOS build must
pass real-device testing for Sign in with Apple, camera capture, location check-in,
contacts, sandbox IAP, APNs, account deletion, and the complete daily-post flow before
Android release work resumes. Android is explicitly post-launch until Play Billing and
Google server-side purchase notifications are implemented.

## What changed in this session

### Backend (live on Supabase project `nvywxqntsrlrmlrpfuub`)
- **0006_security_hardening** — pinned `search_path` on trigger functions, revoked `anon` EXECUTE on every SECURITY DEFINER function (client keeps `checkin`/`checkout` + RLS helpers only), dropped the avatars-bucket listing policy.
- **0007_performance** — all 42 RLS policies rewritten to `(select auth.uid())` (per-statement instead of per-row evaluation), the three `FOR ALL` write policies split so they no longer stack on SELECT, 9 missing FK indexes added.
- **0008_cron_and_push** — `streak-tick` and `checkout-stale` ported from Deno to SQL (`streak_tick_sweep`, `checkout_stale_sweep`) and scheduled with **pg_cron** (every 15 min / hourly). New `notifications_push` trigger: every `notifications` insert POSTs to the `send-push` edge function via pg_net — push delivery is now actually wired.
- **0009_avatar_webhook** — storage trigger fires `avatar-process` on every avatar upload (it was never invoked before).
- **avatar-process v2** — now produces a real blur (12px downscale → re-encode) instead of copying the original; the free-tier "blurred viewers" paywall promise is honest now.
- **iap-webhook v2** — full App Store JWS verification: x5c chain validated cert-by-cert and pinned to Apple Root CA-G3; consumable purchases no longer flip `subscription_tier` (was a bug — any consumable granted Plus). Deployed with `--no-verify-jwt` (Apple sends no Supabase JWT).
- **delete-account (new)** — deletes auth user + storage objects; cascades wipe all rows. Required for App Store review.

### Client
- **Feed ranking** (`lib/feedRanking.ts` + tests): recency half-life decay (6h) + unviewed-first + verified-at-gym and daily-drop boosts + capped social proof + own-post demotion. Integrated in `useFeed`.
- **IAP is purchasable**: `lib/iap.native.ts` init/listeners/finishTransaction, `appAccountToken` = Supabase user id (webhook mapping), paywall + settings/plus subscribe buttons live, restore purchases, subscription state synced into the Zustand store.
- **Push + realtime mounted**: device token registration (onboarding + app start), `useRealtime` mounted in root layout.
- **Real check-in**: presence store no longer hardcodes `atGym: true`; foreground geofence sync calls the server-verified `checkin`/`checkout` RPCs.
- **Sign out + delete account** in Settings → Account; privacy toggles (ghost mode, discoverable, schedule visibility, arrival notifs) wired to `profiles`.
- **Reactions persist** (`post_reactions`), replays recorded, own-post saves persist; streak query no longer throws for new users.
- **Mock screens replaced with real data**: profile, user/[username], friends activity, chat (live messaging with realtime) — see agent notes in git history.
- **Config**: `aps-environment` now derives from `EXPO_PUBLIC_APNS_ENV`; `eas.json` preview/production profiles carry Supabase env; production sets APNs to `production`.
- **Inbox simplified** (Snapchat-style): 4 tabs → 3 (ACTIVITY / CREW / DISCOVER). The dead static "REQUESTS" tab is gone — real incoming friend requests now render pinned atop CREW with Accept/Pass and a count badge on the tab (`useIncomingRequests` / `useRespondToRequest`).
- **0010_conversation_unique** — unique index on the conversation participant pair (prevents concurrent double-create).

## Remaining manual steps (cannot be done from code)

1. **Supabase dashboard**
   - Auth → enable **leaked password protection** (advisor WARN, one toggle).
   - Set edge-function secrets for push: `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (base64 `.p8`), `APNS_BUNDLE_ID=com.octavio.spotted`, `APNS_ENV=production`.
2. **Apple Developer / App Store Connect**
   - Create the app (bundle id `com.octavio.spotted`), APNs key (`.p8`).
   - Create IAP products matching `lib/iapShared.ts` (monthly + annual auto-renewing subs with 7-day intro offer, 4 consumables).
   - App Store Server Notifications URL → `https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/iap-webhook` (v2).
   - Privacy nutrition labels: location, photos, user content, purchases.
3. **EAS**
   - Build TestFlight candidate: `npm run ios:build:production`.
   - Fill `submit.production.ios` (`ascAppId`, `appleTeamId`), then run `npm run ios:submit`.
   - Test IAP on a real iPhone with a sandbox tester first (`npm run ios:build:preview`).
4. **Seed content** — run `seed-gyms` for launch cities (Overpass import) so onboarding home-gym pick isn't empty.
5. **Android (later)** — IAP webhook currently handles Apple only; Play Billing needs `obfuscatedAccountId` mapping + RTDN endpoint before Android launch.

## Deliberately accepted advisor warnings
- `authenticated` can execute `checkin/checkout/are_friends/can_read_post/is_blocked` — intentional (client RPCs + RLS helpers).
- `cube`/`earthdistance` in `public` schema — moving them mid-flight risks breaking the `checkin` distance math; revisit only with a maintenance window.

## Monetization strategy (Spotted+)

Current gates (keep these five, don't add more — scarcity is the pitch):
viewer list, travel mode, flame color, streak revival, day-seven push.

- **Price**: $4.99/mo, $34.99/yr (intro: 7 days free). Gym demographic tolerates this; annual is the margin product.
- **Conversion levers already built**: blurred viewer list is the #1 Snapchat-proven curiosity gate; streak revival is a rage-buy consumable — surface it in the streak-break push, not just the app.
- **Ideas queue (post-launch, in order)**:
  1. **Streak insurance** (freeze tokens) as a consumable 3-pack — infra already exists (`freeze_tokens`).
  2. **Gym leaderboards** (weekly check-in count per gym) — free to view, Plus to see who's above you. Uses existing `checkins`; one materialized view.
  3. **Duo streaks** (mutual streak with one friend, Snapchat-style) — the strongest retention mechanic in this genre; schema needs one table.
  4. **Brand drops** — sponsored daily prompts ("PR day w/ Gymshark") once DAU justifies it; keep out of v1.

## Growth mechanics
- Contacts invite (expo-contacts already a dependency) with a "your crew isn't here yet" empty state.
- Friend suggestions RPC already ranks by mutual friends + same gym — surface it aggressively in onboarding.
- Day-seven push (already a paywall surface) doubles as the churn-rescue notification.

## Algorithms in place
- **Feed**: `lib/feedRanking.ts` — tune constants with real data; instrument view-through rate per position before touching weights.
- **Friend suggestions**: `get_friend_suggestions` RPC (mutuals → gym score → recency).
- **Streaks**: SQL sweep every 15 min, timezone-correct per profile, freeze tokens spend before breaking.

## QA gates before submitting
- `npm run typecheck && npm test && npm run lint`
- `npm run ios:export`
- `supabase test db` (pgTAP RLS suites)
- Real-device: sign-in with Apple → onboarding → camera post → friend flow → paywall purchase (sandbox) → push received → streak visible → delete account.

## OTA updates (expo-updates — configured in the 1.2.1 build)

EAS Update ships JS/asset changes to installed apps without a store build or
review. Configured 2026-08-31; first OTA-capable binary is 1.2.1.

- `app.config.ts`: `updates.url = https://u.expo.dev/c64d03b4-83c0-48c9-863b-f225fb8de92d`
  and `runtimeVersion: { policy: "appVersion" }` — every OTA is scoped to
  binaries with the SAME `version` (1.2.1 updates only reach 1.2.1 builds), so
  an update can never land on a binary missing native code it needs.
- `eas.json`: build profile `production` pins channel `production`; `preview`
  pins channel `preview` (TestFlight/internal can be updated independently).
- **Publish ONLY with**: `npm run ota -- --channel production --message "what changed"`.
  Users receive it across their next two launches (download on first, applied
  on second).
- **NEVER run a bare `eas update`.** Incident 2026-09-02: a bare
  `eas update --channel production` exported the bundle with an EMPTY Supabase
  config (eas-cli resolves the EAS-hosted `production` environment and ignores
  `.env`; that environment had no variables). Every install that took the
  update ran the offline demo mode and opened "signed in" as the mock
  "Octavio" profile (no real session or data was involved — the client pointed
  at example.supabase.co — but it looked like an account takeover). Fixed by
  hotfix update `01a060a4-a887-774e-b3a2-f4746549a9e2`. Three guards now exist:
  1. `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` live in the EAS `production` and
     `preview` environments (`eas env:list --environment production`).
  2. `app.config.ts` throws if they are missing (builds and updates both
     evaluate it). `SPOTTED_ALLOW_UNCONFIGURED=1` is the explicit opt-in for
     running the local demo mode.
  3. `stores/auth.ts` never enters demo mode in a release bundle (`!__DEV__`
     → signed-out), so even a bad bundle cannot impersonate.
  `scripts/publish-update.mjs` (the `ota` script) sources `.env`, passes
  `--environment`, then fetches the manifest EAS is serving and fails unless
  it carries the real Supabase URL. Emergency rollback:
  `npx eas-cli update:roll-back-to-embedded --channel production`.
- **Native changes (new module, permission, plugin, SDK bump) still require a
  real build + store review — and bump `version`, which starts a fresh
  runtime so older binaries never receive the new JS.**
- After bumping `version` for a store release, remember future OTAs target the
  new version's runtime; the old binary keeps its last compatible update.
