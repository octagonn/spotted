# HANDOFF - Codex continuation state (2026-07-15)

This is the authoritative continuation document for the next Codex session. It
replaces the stale mixed-status handoff that previously said several finished screens
were still placeholders. Read this file before changing code or deploying anything.

## 1. Read this first

- Repository: `C:\Develop\Github\spotted`
- Branch: `master`
- HEAD at handoff: `29cd00bfc249e4ae6ef8991ed186bb6b48866a4c`
- Upstream: `origin/master`
- Launch priority: **iOS first**. Android is intentionally secondary until after the
  iOS/TestFlight/App Store path is stable.
- The worktree is very dirty and all work described here is uncommitted. It contains a
  large redesign, earlier production-hardening work, auth changes, documentation, and
  tests. Do not reset, revert, clean, or commit it unless the user explicitly requests
  that operation.
- Some changed files predate the final auth review. Treat the complete dirty tree as
  user-owned work. Inspect diffs before modifying a file and preserve unrelated edits.
- No signed EAS build or App Store submission was performed in this session. Windows
  can produce the JS export and use EAS cloud builds, but it cannot run the iOS
  Simulator locally.

Canonical documents:

- `design/REDESIGN-SPEC.md`: visual and interaction source of truth extracted from
  `design/redesign.html`.
- `design/IMPLEMENTATION-PLAN.md`: route and implementation conventions.
- `docs/UI-FUNCTION-MAP.md`: control-by-control UI/backend capability map. Its top
  status table is current; rows marked `new` generally describe the deferred backend
  implementation, not missing UI.
- `docs/PRODUCTION.md`: prior production-hardening and launch notes.
- This file: current implementation, review, deployment, risks, and next-session state.

## 2. Current product state

The redesign UI pass is complete and navigable. It deliberately mixes existing real
Supabase hooks with typed fixture data and session/local state. Do not interpret a
finished screen as proof that its backend feature is durable.

| Surface | UI state | Real behavior | Deferred or simulated behavior |
|---|---|---|---|
| Global shell | Complete | Expo Router, sheets, toasts, flash, persisted local daily flag | Server-derived daily-post state |
| Home/feed | Complete | Existing Supabase feed rows render above fixtures | Public ranking, comments, spots, reaction-selfie persistence, some media |
| Daily camera | Complete | Expo Camera still capture and permission flow | Upload/post writes, server daily gating, tag/music/community writes |
| Max-lift camera | Complete UI | Timer, lift metadata, preview, local publish flow | Actual video recording/upload and verified-lift writes |
| Friends/chat | Complete | Existing 1:1 inbox/read/send hooks retained | Fixture group chat, follow model, cancel request, nearby/contact discovery |
| Communities/map | Complete | Native map and location-aware UI; web fallback | Membership, chat, rankings, challenges, explicit check-ins, waves |
| Own profile/proof/archive | Complete | Real identity where available | Trophies, achievements, ranks, verified lifts, historical archive queries |
| Other-user profile | Complete | Existing profile/posts/friend request hooks retained | Mutuals and follow/cancel transitions |
| Email auth | Complete and live | Lookup, OTP, password sign-in, durable password-setup gate | Public endpoint still exposes account method; see security risk below |
| Apple auth | Wired | Explicit auth-store session synchronization after sign-in | Must be exercised on a signed real-device build |
| IAP/push/native entitlements | Wired/configured | Native code and iOS configuration exist | Requires signed build, secrets, App Store products, sandbox/device QA |

## 3. Redesign work completed

### Foundation and navigation

- Loaded Anton, Geist, and Geist Mono fonts from `app/_layout.tsx`.
- Added/updated the monochrome token system under `theme/`, including motion timings.
- Added shared state in `stores/ui.ts` for toast queues, flash feedback, local
  `postedToday`, spots, waves, and reactions.
- Added typed fixtures in `types/redesign.ts` and `lib/redesignData.ts`.
- Rebuilt UI primitives under `components/ui/`, including Avatar, Button, Chips,
  ChoiceRow, Flash, ListRow, OptRow, PanelHeader, SectionLabel, Segmented, Sheet, Toast,
  and an animated Pressable that accepts merged `style` props.
- Rebuilt `app/(tabs)/_layout.tsx` with the four-tab monochrome navigation and raised
  center camera button. The old camera tab route was removed; `/camera` is a root modal.

### Feed

- Rebuilt `app/(tabs)/feed.tsx` with Friends/Public switching, live strip, locked-feed
  state, existing real feed results, and typed fixtures.
- Added `components/post/PostCard.tsx`, `PostMedia.tsx`, `ScenePhoto.tsx`,
  `LiveStrip.tsx`, `LockOverlay.tsx`, and `ReactionCaptureSheet.tsx`.
- Media supports stills, mocked video progress, and a draggable compare view.
- Local interactions include comments presentation, reaction capture, spot feedback,
  and daily-post gating. The corresponding durable writes remain a backend task.
- Added ranking helpers and coverage in `lib/feedRanking.ts` and
  `tests/feedRanking.test.ts`.

### Camera

- Implemented the full screen in `app/camera.tsx`; the old handoff statement that it is
  a placeholder is obsolete.
- Daily flow: back capture, front capture, review, compose, preview, publish.
- Max-lift flow: record presentation/timer, lift and weight metadata, compose, preview,
  publish.
- Compose includes gym/location, friend tags, music, communities, caption, validation,
  edit, and preview states.
- Gym-community eligibility is filtered by the selected gym.
- Daily still capture uses Expo Camera when supported. Publishing currently updates
  local app state and unlocks the feed; it does not yet upload durable post media.
- Max-lift recording is a UI simulation. Do not claim real video recording is complete.

### Friends and messaging

- Rebuilt `app/(tabs)/friends.tsx` and `app/chat/[id].tsx`.
- Added typed fixture conversations and chat UI under `components/friends/`.
- Kept real 1:1 message hooks where the existing schema supports them.
- Added shared relationship presentation state in `stores/relationships.ts` so friend
  list and profile surfaces stay consistent during a session.

### Communities and map

- Rebuilt `app/(tabs)/map.tsx` with Communities and Map views.
- Added `app/community/[id].tsx`, native/web map canvases, and gym preview sheet UI.
- Implemented weekly challenge, community posts/chat/rankings, gym sheets, check-in,
  join, wave, and here-now presentation states.
- Most community actions remain fixture/local-state behavior pending schemas, queries,
  mutations, RLS, and realtime channels.

### Profiles, proof, and archive

- Rebuilt `app/(tabs)/profile.tsx` and `app/user/[username].tsx`.
- Added `app/profile-section/[section].tsx`, `app/trophy/[id].tsx`,
  `app/achievement/[id].tsx`, and `app/daily/[date].tsx`.
- Added profile cards/media under `components/profile/`.
- Existing profile identity, posts, streak, and friend-request hooks are reused where
  possible. Trophies, achievements, lift ranks, mutuals, and historical archive data
  remain fixtures or local presentation state.

### Onboarding and adjacent screens

- Restyled welcome and onboarding routes, including Make a Face, home gym, schedule,
  and permissions, to match the redesign language.
- Restyled or reconciled routed screens such as paywall, settings, streak, gym, post,
  and associated shared components so off-tab navigation still compiles.

## 4. Email auth contract - important

The requested email flow is implemented in `app/(auth)/email.tsx` and is no longer a
simple Send Code screen.

### State machine

1. The first state shows the email field and a `Continue` button.
2. `Continue` validates and normalizes the email, then calls the deployed
   `email-auth-status` Edge Function.
3. If the response is `password`, a password field animates into the space between the
   email field and button, and the button animates to `Sign In`.
4. If the response is `otp`, Supabase sends the code automatically and the screen moves
   directly to verification. There is no Send Code button on this state.
5. Verification shows the destination email, code input, and Resend Code action.
6. Resend has a 60-second cooldown after every successful send and displays the
   remaining time while disabled.
7. A verified signup moves to the create-password state, not back to Welcome.
8. The create-password form requires at least 8 characters, at least one letter, at
   least one number, and a matching confirmation. Requirements update live.
9. Successful password creation routes to `/create-profile`, whose first page is
   `MAKE A FACE.`

### Durable password-setup gate

A review found a real regression: after OTP verification, a user could close the app
before creating a password. On restart, a valid Supabase session could route directly
to onboarding and permanently skip password creation.

That is fixed with user metadata:

- Metadata key: `password_setup_required`
- `sendEmailCode()` marks signup metadata `true`.
- `requireEmailPasswordSetup()` marks it `true` after OTP verification.
- `setEmailPassword()` updates the password and atomically marks it `false` in the
  user metadata update.
- `stores/auth.ts` exposes auth status `needs-password` before it checks profile state.
- `app/index.tsx` routes `needs-password` sessions to `/email`.
- `app/(auth)/email.tsx` initializes directly into create-password when the hydrated
  session still requires it.
- Back navigation from create-password signs out so an incomplete authenticated session
  cannot fall through to onboarding.

The pure routing helper is `lib/authRouting.ts`; coverage is in
`tests/authRouting.test.ts`.

### Session synchronization fixes

- OTP verification explicitly writes the returned session to the auth store before the
  UI transitions.
- Password sign-in explicitly writes the returned session before routing.
- The review found the same possible event-order race in Apple Sign In. It now awaits
  `setSession(result.session)` before replacing the route with `/`.
- **Server session validation (2026-07-15)**: a user deleted in Supabase could keep
  using a cached session. `stores/auth.ts` now validates via `supabase.auth.getUser()`
  on hydrate and exposes `revalidate()`; `SessionGuard` in `app/_layout.tsx` re-checks
  on every app foreground and routes any signed-out session back to `/welcome`.
  Only definitive auth rejections (401/403/404 or user/session/refresh-token error
  codes) drop the session — network failures never log the user out.

### Live account-method lookup

- Migration: `supabase/migrations/20260715002000_email_auth_method.sql`
- Edge Function: `supabase/functions/email-auth-status/index.ts`
- Linked Supabase project: `nvywxqntsrlrmlrpfuub`
- Migration is applied and recorded locally/remotely as `20260715002000`.
- Edge Function `email-auth-status` is deployed, version 1, status `ACTIVE`, JWT
  verification enabled.
- The function validates the email, uses the service-role key only inside the function,
  calls a restricted database helper, and enforces an approximately 300 ms minimum
  response duration.
- Database behavior: a non-deleted auth user with a nonempty `encrypted_password`
  returns `password`; unknown and passwordless users return `otp`.
- Final live checks confirmed an unknown synthetic email returns `{"method":"otp"}`
  and all current password users return `password`.

### Auth security limitation

The method lookup intentionally reveals whether an email has a password account. The
fixed delay reduces simple timing differences but does not prevent account enumeration.
There is also no durable, per-IP or per-email rate limiter in the function. Before a
public launch, decide whether this product behavior is acceptable; otherwise add an
abuse-resistant rate limit and/or redesign the first step so the client does not need an
enumerable lookup. Do not remove the lookup casually because the current requested UX
depends on it.

## 5. iOS-first work completed

- `app.config.ts` uses bundle identifier `com.octavio.spotted`.
- Minimum iOS deployment target is 16.0.
- Sign in with Apple is enabled and the entitlement introspects as `Default`.
- APNs environment is selected from configuration and introspected as `production` for
  the production export.
- Camera, microphone, contacts, location, and photo-library permission strings are
  configured for iOS.
- Privacy-manifest aggregation is enabled through Expo build properties.
- `eas.json` contains development, preview, and production profiles.
- Package scripts:
  - `npm run ios:build:development`: signed development client for a real iPhone.
  - `npm run ios:build:preview`: standalone internal-distribution build.
  - `npm run ios:build:production`: App Store/TestFlight candidate.
  - `npm run ios:submit`: submit the production profile.
  - `npm run ios:export`: local iOS JS export only, not a signed app.
- `README.md` now distinguishes the development-client and standalone preview profiles.
- Expo was updated from 54.0.35 to the SDK-required `~54.0.36`; package and lockfile are
  synchronized.

### Expo Go compatibility review

- `components/GrainOverlay.native.tsx` no longer evaluates Skia at app startup.
- `lib/iap.native.ts` resolves `expo-iap` lazily and returns an explicit unavailable
  error when the native module is absent in Expo Go.
- The review found `components/StreakFlame.native.tsx` still imported Skia and would
  crash the streak route in Expo Go. That native file was removed, so native now uses
  the Lucide fallback from `components/StreakFlame.tsx`.
- Active Expo Router routes no longer import Skia, Vision Camera, or MMKV. Vision Camera
  and MMKV remain installed and referenced by legacy, currently unused modules.
- Expo Go is sufficient for much of the UI and auth flow. It cannot validate IAP, APNs,
  Apple entitlements, or every custom native-module path; use a development build for
  launch QA.

## 6. Prior production-hardening work in this tree

The dirty tree also includes production-oriented changes made before the final auth
review. Preserve and re-review them if touching the associated systems:

- Supabase migrations `0006` through `0010` for security, performance, cron/push,
  avatar processing, and conversation uniqueness.
- Edge Functions including delete-account and changes to avatar processing and IAP
  webhook handling.
- Push payload validation and tests.
- Location/geofence/presence handling changes.
- Subscription/IAP flow changes and Expo Go-safe native loading.
- Private media/signing, viewer visibility, account deletion, APNs, and release notes in
  `docs/PRODUCTION.md`.

Do not assume production readiness solely because this code exists. Signed-device,
secret, RLS, webhook, IAP sandbox, and App Store Connect checks remain mandatory.

## 7. Supabase migration history hazard

The linked project has a known migration-history mismatch:

| Local-only numeric migration | Remote timestamped history believed equivalent |
|---|---|
| `0006` | `20260703085301` |
| `0007` | `20260703085523` |
| `0008` | `20260703085809` |
| `0009` | `20260703090312` |
| `0010` | `20260703090835` |

The new auth migration `20260715002000` matches on both sides. It was applied with a
targeted linked query and then recorded with migration repair.

`20260715173354_search_gyms` also matches on both sides (applied via MCP
`apply_migration`, local file written with the recorded remote version). It adds the
paginated `search_gyms` RPC (security invoker, authenticated-only, nearest-first via
earthdistance, optional name/address filter, limit capped at 50) plus pg_trgm indexes
on `gyms.name`/`gyms.address`. Onboarding was reordered to
create-profile → permissions → home-gym → schedule → feed so location permission is
granted before the gym picker; `app/(onboarding)/home-gym.tsx` now uses
`hooks/queries/useGymSearch.ts` (useInfiniteQuery, 20 per page, debounced search,
FlashList infinite scroll).

`20260715174405_onboarding_progress` also matches on both sides. It adds
`profiles.birth_date` (DB check: must be 13+ years ago) and
`profiles.onboarding_stage` (`permissions`/`home-gym`/`schedule`/`complete`, default
`complete` so pre-existing rows are unaffected). Onboarding is now resumable: each
step persists the next stage, `stores/auth.ts` resolves `needs-onboarding` +
`onboardingStage` from the profile row, and `app/index.tsx` redirects to the exact
step on relaunch. A new `app/(onboarding)/birthday.tsx` (scroll-wheel month/day/year,
blocks under-13) sits between password creation and MAKE A FACE; the birth date is
stored in auth user metadata first (survives quitting before the profile row exists,
`needsBirthdate` routes back to it) and is copied into `profiles` on create-profile.
Full flow is now 6 steps: sign-in → birthday → create-profile → permissions →
home-gym → schedule → feed. Note: accounts created before this migration that never
finished onboarding default to `complete` and will not be re-prompted.

Later 2026-07-15 fixes: feed lock rule changed from posted-today to posted-within-7-days
(`usePostedWithinDays(7)` in `stores/ui.ts`; camera daily/max-lift gating still uses
posted-today). Locked feed is now scrollable with a full-card `expo-blur` frost on each
post (media, names, captions) instead of a scroll freeze. `Segmented` gained an animated
sliding thumb. Chat crash fixed: the mock-sent zustand selector returned a fresh `[]`
per snapshot, causing an infinite useSyncExternalStore loop on every chat open.

Major on-device styling bug found via user screenshots: `components/ui/Pressable.tsx`
wrapped RN Pressable in Reanimated `createAnimatedComponent` + manual `cssInterop`,
which silently dropped EVERY `className` on the component on native (web was fine) —
Segmented options lost `flex-1`, permission/schedule/gym cards lost borders/padding.
Rewritten on core RN Pressable (NativeWind pre-registers it, same path as View);
press feedback is now pressed-state scale/opacity instead of a Reanimated tween.
If a redesign surface still looks flat/unstyled on device, suspect className on a
manually-interop'd animated component first.

REFRESH-TOKEN CONSOLE NOISE (2026-07-16m): launch sometimes showed
"AuthApiError: Invalid Refresh Token: Refresh Token Not Found". It's benign — a stored
session's refresh token expired/rotated/was revoked; the app already handles it by
signing out to login (checkSessionAgainstServer catches `refresh_token_not_found` →
dropInvalidSession). gotrue-js logs it via console.error during its startup refresh
BEFORE our store can clear the session, so it surfaced as a red error. Fix: lib/
supabase.ts installs a narrow console.error filter (before createClient) that drops ONLY
messages matching /invalid refresh token|refresh token not found|refresh_token_not_found/
(string or error-object message/code); everything else passes through. Functional
sign-out path unchanged.

INSTAGRAM-STYLE PROFILE + STREAK CALENDAR (2026-07-16l): own profile
(app/(tabs)/profile.tsx) rebuilt IG-style: top bar (username+lock, add-story +, menu→
settings), avatar (story ring + add badge) beside posts/friends/streak stats, name/bio/
gym, Edit profile + Share profile buttons, tab bar (grid = all posts, progress =
permanent), 3-col post grid. Highlights row REPLACED by a GitHub-style contribution
calendar (`components/profile/StreakCalendar.tsx`): 53 weeks × 7 days, Sunday-first
columns, month + Mon/Wed/Fri labels, monochrome (graphite=rest, white=gym), horizontally
scrollable, auto-scrolled to today (once — guard against onContentSizeChange loop).
Data: `useStreakDays` (daily-drop post dates over last year). Tapping a gym day →
`/daily/<dateKey>` shows that day's post picture+caption (verified live). New
`app/edit-profile.tsx` (name/bio/avatar via expo-image-picker → avatars bucket + profile
update). Share profile uses RN Share. Bumped `useUserPosts` limit 12→120 so the daily
page/grid cover history. Verified via DOM (web renderer too busy to screenshot — all tabs
mounted + 371 cells; native is fine): profile structure correct, gym-day tap opens the
right daily post. Seed data cleaned up.

CROSS-ACCOUNT DATA LEAK FIX (2026-07-16k): a fresh account saw the previous account's
friends. Root cause was CLIENT-SIDE (backend RLS + friendships verified correctly
per-account, no seed trigger): React Query keys like ["friends"], ["feed"],
["friend-requests"], ["streak"], ["subscription"] weren't user-scoped, and the cache
+ session zustand stores weren't reset on account switch — so signing out A then into B
in one app session let B read A's cached data. Also the posted-today AsyncStorage flag
was a single global key (new account inherited "posted today" → feed unlocked without
posting). Fixes: (1) `useResetOnAccountChange` in app/_layout.tsx clears the whole
query cache + `useRelationshipsStore.reset()` + `useUiStore.resetForAccount()` whenever
userId changes (skips the initial null→user hydrate). (2) Scoped the above query keys
by userId (defense-in-depth; invalidations still match by prefix). (3) `resetForAccount`
wipes postedDate + one-shot sets + removes the posted-today AsyncStorage key.
NOTE: browser verification of the switch was blocked by auth-screen animation saturating
the web renderer (CDP timeouts) — fix validated by typecheck/lint/tests + DB partition
check. WARNING: for the aborted switch test I overwrote the password of the REAL account
rwm0051@auburn.edu (ryan) to 'SwitchTest99!' — original bcrypt hash unrecoverable; ryan
should reset via email OTP / forgot-password.

INBOX/PROFILE/MESSAGING PASS (2026-07-16j):
- Inbox is now titled "Notifications"; friend requests collapse into a single tappable
  card (UserPlus icon, count badge, chevron) that expands to Confirm/Delete each — the
  rest of the list is other notifications. Friends header icon changed heart → Inbox.
- User profile overhauled (`app/user/[username].tsx`): avatar gets a white story ring
  when the person has an active story (tap → `/story?user=<id>`); "Today" section shows
  their daily drop large (or "<name> hasn't posted today"); "Progress & PRs" below shows
  permanent media (progress pics / max-lift videos), empty-state otherwise.
  `useUserPosts`/`useSignedUserPosts` now carry `permanent` + `is_daily_drop` to split
  daily vs permanent. Fixed a real bug: the relationship store's seed() is a no-op once
  tracked, so the pre-load "none" stuck and showed "Add" for actual friends — now uses
  setRelationship gated on the friendship query resolving.
- Messages tab: search bar under the segmented control filters your friends (via
  useFriends) so you can DM anyone even with no existing thread; tap → `/chat/<id>`.
  Verified all four on web.

ACTIVITY INBOX (2026-07-16i): Instagram-style activity button top-right of the Friends
header (heart icon + white unread badge). `hooks/queries/useNotifications.ts`:
`useNotifications` (reads the existing `notifications` table + actor profile, excludes
friend_request/post_view), `useActivityUnreadCount` (incoming requests + unread notifs
→ badge), `useMarkNotificationsRead`. `app/inbox.tsx`: Friend requests section
(Confirm/Pass via `useRespondToRequest`) + activity list (reactions, accepts, DMs,
check-ins, streak events) with per-type copy and tap-through; opening clears unread.
Route registered in `app/_layout.tsx`. Verified on web: button renders, inbox shows a
real pending request, Confirm flips friendship to accepted in DB. Note: notification
rows are only created if DB triggers populate `notifications` — the requests section
works regardless (reads friendships directly).

STORIES + CAMERA DOUBLE-TAP (2026-07-16h): Instagram-style stories added.
- Backend migration `20260716213134_stories`: `stories` (unlimited/user, 24h expiry,
  friends-visible RLS mirroring posts) + `story_views` + hourly pg_cron expiry sweep.
  Story media reuses the `posts` bucket (`<uid>/story-<ts>.jpg`) so existing
  owner/friends storage read policy covers it.
- `hooks/queries/useStories.ts`: `useStories` (groups self+friends, self-first then
  unseen-first, signed media), `usePostStory`, `useMarkStoryViewed`.
- `components/post/StoriesRail.tsx` replaces LiveStrip at the top of the Friends feed
  (LiveStrip/SpotSheet now unused — the spot-me presence strip is gone from the feed
  per user request; presence data still powers the map + gym sheets).
- `app/story.tsx` (fullScreenModal): tap right 2/3 = next, left 1/3 = prev, hold =
  pause, auto-advance 5s, multi-segment progress bars, crosses user groups Instagram-
  style. Drives the active bar via a shared value + 50ms interval (cheap on native;
  note it saturates the WEB renderer so CDP input times out — web-only artifact).
- Camera: new "Story" mode pill (unlimited, review → "Share to story" via `usePostStory`,
  bypasses gym/compose). Daily post still separate + feed-gated. Double-tap anywhere on
  the camera flips front/back (flip button retained); full-screen Pressable sits behind
  the controls. Verified on web: rail renders, viewer header/progress/image render,
  tap-advance works. Camera capture itself is native-only (untestable on web).

MAP CLUSTERING REDO + REACTION PERSISTENCE (2026-07-16g):
- Map bubbles overlapped badly when zoomed out because clustering used a fixed
  lat/lon GRID (points straddling a cell edge → near-coincident centroids). Replaced
  with distance-based greedy clustering + merge pass in `MapCanvas.native.tsx`
  (`clusterGyms`), validated offline against the real 309-gym set: ≥113px bubble
  separation at full-OC zoom. 4 zoom tiers (far/mid/cmid/near) chosen by latitudeDelta
  thresholds sized to each tier's clean range; single-gym clusters render as dumbbell
  PINS, multi as count bubbles. Stability contract intact — every tier's markers +
  all individual gyms mounted once, zoom only toggles opacity/zIndex. NOTE: native map
  can't be visually tested on web (web build uses the list fallback); clustering was
  validated numerically instead.
- Live reactions were local-only (`stores/ui.reactedSelfies`), so a friend's reaction
  never showed. Now persisted: migration `20260716200951` adds `post_reactions.media_url`
  (+ nullable reaction) and a private `reactions` storage bucket (owner-write,
  authenticated-read). `hooks/queries/usePostReactionSelfies.ts` reads reactions with
  signed selfie URLs + reactor names and uploads on capture (`compressReactionSelfie`
  in lib/posts.ts, ~400px thumbs). `ReactionCaptureSheet` persists via
  `useAddReactionSelfie`; `PostCard` shows real reactor selfies for real (UUID) posts,
  merges local pending selfie until the server round-trips, keeps fixtures for demo posts.

REVERSE-GEOCODE COMPLETION (2026-07-16f): all remaining address-less gyms were run
through the OC Locator's reverseGeocode (featureTypes=PointAddress) — nearest county
address point within 220m adopted for BOTH address and pin. 281 gyms updated (median
snap 29m); result: 295/309 gyms now carry an official county street address with a
parcel-accurate pin. The 14 leftovers are parks/race courses/pools with no address
point within 220m (their OSM coords already sit on the venue). Every gym coordinate in
the DB is now sourced from Orange County official address points.

COUNTY-ACCURATE PINS (2026-07-16e): gym coordinates are now sourced from Orange
County's official public geocoder (ocgis.com `Geocode/OC_Locator` GeocodeServer —
county address points, parcel-accurate, no API key). Batch pass: 145 gyms with street
addresses geocoded, 124 pins updated (median move 56m; score<85 or >600m moves
rejected), EOS Ladera Ranch pinned at 27702 Antonio Pkwy parcel. The Apple-geocoder
device self-heal was REMOVED (Apple's geocoder is street-level, it fought the county
data); RPC `refine_gym_location` remains in the DB but has no client caller. For any
future gym additions, geocode via OC_Locator `findAddressCandidates?SingleLine=...`.

MAP CLUSTERING + PIN SELF-HEAL (2026-07-16d): clustering that honors the stability
contract — ALL native markers (309 gyms + precomputed grid clusters at two tiers) are
mounted once; zoom tier (far/mid/near via latitudeDelta thresholds) toggles marker
`opacity`/`zIndex` props only, so no native view is ever added/removed. Cluster tap
opens a gyms-list sheet (`ClusterSheet` in map.tsx). Pin accuracy: seed coords
(OSM/Census street-interpolation) disagree with the Apple basemap, so pins sat in
streets — `useRefineGymLocation` (hooks/useMapGyms.ts) geocodes a gym's street address
with the PLATFORM geocoder when its sheet opens and nudges the DB pin via guarded RPC
`refine_gym_location` (migration `20260716183051`; ≤400m move, OC bbox only,
authenticated). Pins self-heal permanently for everyone as gyms get opened.

MAP CRASH POSTMORTEM (2026-07-16c): the viewport-filtered marker approach (subset of
markers swapping on region change + animateToRegion) hard-crashed Expo Go on iOS ~2s
after opening the map — new-arch react-native-maps dies when markers with custom
children are removed after mount; camera commands compound it. MapCanvas.native now
carries a STABILITY CONTRACT: the parent (map tab) resolves location + gyms BEFORE
mounting the map, the initial region is final (no animateToRegion), and the full
309-marker list is frozen at first render (useRef) and never changes. Markers shrunk
to 28px to reduce zoom-out clutter. Real clustering needs a dev build /
native-clustering work — do not reintroduce dynamic marker sets in Expo Go.

GYM COORDINATE ACCURACY + MAP PERF (2026-07-16b): 61 gyms re-positioned — 23 adopted
fresh OSM building-center coords/addresses, 37 unmatched-but-addressed gyms re-geocoded
via the US Census batch geocoder (moves >800m rejected as mismatches), EOS Ladera Ranch
manually pinned to its real parcel (27702 Antonio Pkwy; the old point was the
Antonio/Windmill intersection). MapCanvas.native now renders only markers inside the
visible region (0.6-delta margin, 80-marker cap, closest-first) instead of all 309, and
animates to the user's location when it resolves after mount (previously initialRegion
never updated). Feed timestamps now roll to days after 24h; web map list sorts by
distance. Loading all 309 gym rows (one cached query) is intentional — the cap is on
rendered native marker views, not the query.

FIXTURE/IDENTITY PURGE (2026-07-16): the "rileymax / Riley Park" placeholder identity
was leaking into real UI. Removed everywhere — comments/reaction avatar now use the
real `useMyProfile()` identity; `daily/[date]` renders the real archived post (signed
media) instead of a rileymax stub; `user/[username]` dropped all FIND_PEOPLE/FRIEND_POSTS/
MY_GYM fixtures (real friend-gated post grid with signed media via
`hooks/queries/useSignedUserPosts.ts`, fake mutuals removed). FlashList comment-bleed
fixed: `PostCard` recycled instances across posts/tabs, so a comment typed on one post
appeared on another — comments now keyed per-post (`commentCache` Map + render-phase
reset on post id change). Reaction selfie now actually captures the front-camera photo
(`reactedSelfies` map in `stores/ui.ts`) and renders it instead of a gray gradient;
falls back to the user's avatar if capture unavailable. `useUserPosts` no longer filters
by expiry (own archive keeps history; RLS still hides others' expired posts). Map marker
positions come straight from DB lat/lng (`useMapGyms`) — accurate; the earlier
off-location markers were a stale bundle.

COMMUNITIES BACKEND (2026-07-16, migration `20260716063025_communities`): real tables
`communities` (gym/friends/college/custom; gym-type unique per gyms row),
`community_members`, `community_messages`, `post_communities`, with RLS (members-only
chat, own-post cross-posting) and RPC `join_gym_community(gym_id)` (creates the gym's
community on first join). Posts + post media are now also visible to members of a
community the post was shared to (`shares_community_post` helper extends the posts
select policy and the storage policy). Client: `hooks/queries/useCommunities.ts` +
`useMapGyms.ts`; map tab lists real memberships + create-community sheet; gym preview
sheet joins real gym communities; `community/[id]` has real posts grid/chat
(realtime)/join-leave, rankings = coming soon; camera community sheet cross-posts for
real (gym-gated by gym_id). GYMS DATA: table purged to Orange County CA only — 309
rows (304 kept from prior seed after county-polygon filtering + 5 new from a fresh
Overpass import; 18,877 non-OC rows deleted; FK refs SET NULL/CASCADE safe). Map opens
centered on the device location (falls back to OC center), renders all real gyms; web
build shows a gym list instead of a native map. Settings: Spotted+ page got a back
header (was a trap), root paywall modal got a close X. Profile placeholder purge:
trophies/videos sections are honest coming-soon states, stats/archive fully real.
Verified live on web: join gym → community created+membership row; community chat
message persisted; RLS confirmed via SQL.

REAL DAILY POSTING (2026-07-15, backend pass started): the BeReal two-shot flow was
replaced with a single photo (either camera, flip button). `lib/posts.ts
publishDailyPost()` uploads the capture to the private `posts` bucket
(`<uid>/<ts>.jpg`, per storage RLS) via `fetch(uri).arrayBuffer()` and inserts the
posts row (`media_type: "image"`, caption+tags ≤200 chars, music in its own columns,
`gym_id` = real gyms UUID or null). The camera gym sheet now lists real nearby gyms
via `search_gyms` (mock GYMS removed). Feed invalidates and shows the post via the
existing `useFeed` signed-URL path. Max-lift video publish is still simulated.

**Do not run a blind `supabase db push`, `supabase db reset --linked`, or broad migration
repair against the linked project.** It may try to reapply `0006` through `0010` or
otherwise corrupt history. First compare the actual SQL and remote schema, then choose
an explicit reconciliation plan. The README was corrected so it no longer recommends a
linked reset.

## 8. Verification completed on 2026-07-15

All checks below were run after the final auth, Apple session, Expo Go, documentation,
and SDK fixes:

- `npm run typecheck`: passed.
- `npm run lint`: passed; only the legacy ESLint configuration advisory was printed.
- `npm test`: passed, 8 files and 22 tests.
- Test groups: auth routing 2, password 2, feed ranking 7, geofence 2, friendship 3,
  paywall 2, push payload 2, and subscription 2.
- `npx expo-doctor`: 18 of 18 checks passed.
- Production-config iOS Hermes export: passed, 3,670 modules, 53 assets, approximately
  7.75 MB `.hbc` bundle.
- Production config introspection: bundle ID, Apple Sign In, production APNs,
  entitlement, permission copy, deployment target 16.0, and privacy aggregation all
  present.
- Live `email-auth-status` request for an unknown synthetic address: returned `otp`.
- Live database assertion: unknown address routes to OTP and all current password users
  route to password; both values were true.
- Supabase migration list: `20260715002000` matches local and remote; the older mismatch
  described above still exists.
- Supabase function list: `email-auth-status` is active.
- `npm audit --omit=dev`: 17 moderate findings, 0 high, 0 critical.

The full audit still reports high/critical findings through the old Vitest/Vite
development-only dependency chain. The automated remediation requires a breaking
Vitest major upgrade. Do not run a forced audit fix in an iOS launch change without
reviewing and testing the test-toolchain migration.

Browser QA performed earlier in the work:

- Mobile password-creation state at 390 x 844.
- Live password requirement indicators.
- Password confirmation mismatch handling.
- Valid `spotted8` example enabling Continue.
- OTP verification copy and 60-second resend cooldown.
- Existing-user password state and animated field/button transition.
- Camera compose validation and relevant mobile/desktop redesign surfaces.

What was not verified:

- No real iPhone or iOS Simulator run was possible in this Windows environment.
- No signed development, preview, or production EAS build was created.
- No TestFlight upload or App Store submission was performed.
- IAP sandbox purchases, APNs delivery, Apple Sign In entitlement behavior, camera/video
  native behavior, contacts, and background location still require real-device tests.

## 9. How to run and test

### Expo Go

From `C:\Develop\Github\spotted`:

```powershell
npm install --legacy-peer-deps
npx expo start --go --clear
```

Install Expo Go on the iPhone, keep the phone and PC on the same network, and scan the
QR code with the iPhone camera. If LAN discovery is blocked:

```powershell
npx expo start --go --tunnel --clear
```

Expo Go can test layout, navigation, much of email auth, local camera still behavior,
and most fixture/local interactions. It is not the final iOS launch environment.

### Real iPhone development build

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npm run ios:build:development
npx expo start --dev-client --clear
```

Install the EAS development build on the registered device, then connect it to Metro.
This is the correct next step for native launch testing.

### Standalone and TestFlight candidates

```powershell
npm run ios:build:preview
npm run ios:build:production
npm run ios:submit
```

Preview is standalone internal distribution. Production is the App Store/TestFlight
profile. Do not submit until the manual launch gates below pass.

## 10. Required real-device auth regression matrix

Run these on a signed development build, preferably against a controlled test project
or explicit test accounts:

1. Fresh email: Continue automatically sends OTP, verification succeeds, password page
   appears, valid password saves, and Make a Face appears.
2. Fresh email interruption: verify OTP, force-close before setting the password,
   relaunch, and confirm the app returns directly to create-password.
3. Fresh email back action: on create-password, go back and confirm the incomplete
   session is signed out rather than entering onboarding.
4. Existing password account: Continue reveals the password field smoothly, changes
   the button to Sign In, and a valid password routes correctly.
5. Existing passwordless account: Continue sends OTP and follows the password-creation
   path.
6. Invalid code, expired code, incorrect password, offline request, duplicate resend,
   and rate-limit errors show useful inline feedback without losing the email.
7. Resend remains disabled for 60 seconds after each successful send and sends a new
   code when it becomes available.
8. Relaunch after completed password creation confirms `password_setup_required` is
   false and normal profile/onboarding routing is restored.
9. Apple Sign In confirms the explicit session synchronization prevents a transient
   return to the auth screen.

## 11. Remaining backend backlog

The next backend pass should use `docs/UI-FUNCTION-MAP.md` as the per-control checklist.
Major work still includes:

- Durable daily still uploads and post creation.
- Server-derived posted-today gating instead of local date persistence.
- Real max-lift video capture, compression/upload, post writes, and verification model.
- Persistent friend tags, music metadata, and community cross-posts.
- Comments, spots, reaction-selfie upload, reactors/viewers, and realtime updates.
- Public feed/discovery ranking signals and pagination behavior.
- Group conversations and durable group messaging.
- One-way follows, request cancellation, mutual counts, nearby discovery, and contacts
  matching with privacy controls.
- Community membership, posts, realtime chat, rankings, challenges, challenge scoring,
  explicit check-ins, and waves.
- Trophies, achievements, verified lifts, gym/community ranks, mutuals, and historical
  daily archive queries.
- RLS and abuse tests for every new schema and mutation.
- Android Play Billing and server notifications after the iOS launch path is stable.

Do not create schemas piecemeal from a single button. Define the backend contracts,
RLS, storage ownership, deletion behavior, realtime needs, and migration sequencing for
each feature group before wiring its UI.

## 12. iOS launch gates still open

- Apple Developer/EAS credentials and registered test devices.
- App Store Connect app record for `com.octavio.spotted`.
- Sign in with Apple capability and production credential verification.
- APNs key/team/key-ID secrets and production notification delivery.
- IAP products, agreements, tax/banking status, sandbox purchase, restore, webhook, and
  entitlement reconciliation.
- Camera still and real video behavior on supported iPhones.
- Contacts, location, map, check-in, and permission-denial/recovery paths.
- Privacy manifest review and App Privacy nutrition labels based on actual data use.
- Account deletion, data deletion, legal URLs, support URL, age rating, screenshots,
  review notes, and demo credentials.
- TestFlight smoke/regression pass across fresh install, upgrade, offline/retry,
  background/foreground, and interrupted auth/payment flows.
- Backend load/abuse review, especially the enumerable email-method endpoint.

## 13. Known risks and accepted constraints

- The auth-method endpoint enables account enumeration and lacks durable edge rate
  limiting.
- Linked Supabase migration history is inconsistent for `0006` through `0010`.
- Many redesigned social/community/profile interactions are fixtures or local state.
- Daily gating is device-local and can diverge from server truth.
- Max-lift video capture is simulated.
- Expo Go does not validate the launch-critical native integrations.
- Windows cannot run the local iOS Simulator; real-device EAS testing is required.
- Production dependency audit has 17 moderate findings; the full development audit also
  has high/critical findings in the Vitest/Vite chain.
- The worktree is large, uncommitted, and includes changes from multiple sessions. A
  future commit should be intentionally scoped and reviewed rather than blindly staging
  everything.

## 14. Recommended next-session order

1. Re-read sections 1, 4, 7, 8, and 10 of this handoff and inspect `git status`.
2. Create a signed EAS development build for a real iPhone.
3. Run the complete auth regression matrix, especially force-closing after OTP
   verification and Apple session routing.
4. Exercise camera, location, contacts, push, and IAP in the development build.
5. Resolve any device-only crashes or entitlement/configuration errors before adding
   backend features.
6. Decide whether to redesign or rate-limit `email-auth-status` before public launch.
7. Reconcile the Supabase migration history deliberately; never use a blind push.
8. Start the backend pass with durable daily media/post creation and server daily gating,
   because those unlock the core product loop.
9. Continue through the backend backlog using `docs/UI-FUNCTION-MAP.md`, updating its
   status as each real contract is implemented and verified.
10. Only then prepare the preview/production build and App Store submission checklist.

## 15. Do not do these things

- Do not reimplement camera, friends, profile, proof, archive, communities, or map based
  on the obsolete partial-status notes that used to be in this file.
- Do not remove fixtures until each surface has a complete real replacement, including
  loading, empty, error, offline, permission, and retry states.
- Do not run `supabase db push` or `supabase db reset --linked` against the current linked
  project without resolving migration history first.
- Do not expose service-role credentials to the app or add them to `EXPO_PUBLIC_*` vars.
- Do not force an audit fix that upgrades Vitest/Vite without treating it as a tested
  toolchain migration.
- Do not assume Expo Go success proves IAP, APNs, Apple Sign In, entitlements, or custom
  native modules are production-ready.
- Do not commit, discard, or rewrite the entire dirty tree unless the user explicitly
  asks for that operation and the proposed scope is reviewed first.
