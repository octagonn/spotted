# Partner Feedback — Fix & Test Plan (2026-08-17)

> **STATUS: Round 1 fully implemented and verified** (tsc + eslint + 88/88
> vitest; RLS changes proven with simulated-JWT SQL). Notable discoveries
> during implementation:
> - Item 12 (taunts): the server was ALREADY midnight-based — the real bug was
>   that `profiles.timezone` was 'UTC' for every user (nothing ever wrote it),
>   so "midnight" was 5 PM Pacific. Fixed with a device-timezone sync hook +
>   a one-time backfill of existing rows to America/Los_Angeles.
> - Item 1 uncovered that blocks did not enforce at all (`is_blocked()` read a
>   legacy representation) — fixed in the same migration.
> - Migrations applied live: `20260817230000_public_interactions_block_enforcement`,
>   `20260817240000_custom_exercises`, `20260817250000_realtime_posts_community_messages`.
> Device-only checks still owed on a phone: tag-picker keyboard, sheet
> keyboard behavior, front/back reaction capture, inset swap, story hold,
> discard-workout alert, offline realtime freshness with two accounts.

Source: Discord screenshots from ts + emal (7 images). Every item was traced to
root cause in code before planning. Items are split into **bugs/quick UX fixes
(implemented this round)** and **feature requests (deferred, approach sketched)**.

---

## Round 1 — implemented now, in this order

### 1. Public feed: can't like or comment (ts)
- **Root cause**: `can_read_post()` (RLS helper gating `post_reactions` /
  `post_comments` / `post_views` / `post_replays` INSERTs) still requires
  friendship, while `posts_select_visible` was later widened to
  `is_account_public`. Public posts are readable but not writable-against.
  Bonus latent bug found: `is_blocked()` still reads the legacy
  `friendships.status = 'blocked'` rows, but `block_user()` writes to the newer
  `user_blocks` table — **blocks don't actually enforce anywhere in RLS**.
- **Fix**: migration redefining `can_read_post` on top of `can_view_content`
  (self OR not-blocked AND (friends OR public account)), and redefining
  `is_blocked` to read `user_blocks` OR the legacy friendships rows. Add
  own-row escape to the `post_reactions` SELECT policy so your own like is
  always visible.
- **Test**: simulated-JWT SQL in a rolled-back transaction: non-friend likes +
  comments on a public account's post (allowed), on a private account's post
  (denied), blocked pair (denied); friends unaffected; own-reaction visible.

### 2. Workout: can't end a session with no logged lifts (ts)
- **Root cause**: `app/workout.tsx` — Finish is `disabled={totals.done === 0}`
  and there is NO discard path anywhere; the session persists to AsyncStorage
  (`workout-session-v1`) forever, surviving restarts.
- **Fix**: when a session is active with zero completed sets, the Finish button
  becomes **"Discard workout"** (confirm alert → `session.clear()` + back).
  Header back chevron on an all-unchecked active session also offers discard.
- **Test**: typecheck + manual: start session, check nothing, discard; check a
  set then uncheck it, discard; confirm a normal finish still works.

### 3. Custom exercises don't persist (emal)
- **Root cause**: `app/workout/select.tsx` keeps custom exercises in
  component-local `useState` — gone on unmount. No table exists.
- **Fix**: new `custom_exercises` table (user_id + name PK, muscle, defaults,
  self-only RLS), hand-patch `types/database.ts`, `useCustomExercises` +
  `useAddCustomExercise` hooks, merge rows into the Select Exercises pool,
  save on custom-form submit.
- **Test**: RLS via simulated JWT; typecheck; manual: create → leave → reopen
  select → exercise is listed (and searchable / favoritable).

### 4. Have to background the app to see new posts & messages (emal)
- **Root cause**: NO realtime on `posts` (not in the `supabase_realtime`
  publication, no client subscription, nothing invalidates `["feed"]` from a
  remote event); messages realtime exists but rests on WAL-RLS evaluating a
  subquery policy, with no polling fallback; the only refresh trigger is the
  OS background→foreground event.
- **Fix**: (a) migration adding `posts` (+ `community_messages`) to the
  realtime publication; (b) `useRealtime` subscribes to posts INSERTs →
  invalidate `["feed"]`; (c) polling fallbacks: feed `refetchInterval` 60s,
  inbox threads 30s, open chat thread 15s (cheap queries, gym-reliability
  matters more than elegance).
- **Test**: verify publication contents live (`pg_publication_tables`);
  typecheck; manual two-account check.

### 5. Video posts: black cell in profile grid + slow open (emal)
- **Root cause**: `useSignedUserPosts` never includes `thumbnail_url` in the
  batch-sign call, so storage-path thumbnails resolve to null; and
  `app/user/[username].tsx` renders raw `media_url` (a video file) into
  `expo-image` with no thumbnail/play badge (own-profile grid does it right).
  The TAGGED grids hardcode `media_type: "image"`.
- **Fix**: sign `thumbnail_url` in the batch; render video cells from
  thumbnail + Play badge on the other-user grid (reuse GridCell pattern);
  thread real `media_type`/thumb through both TAGGED grids. Faster open:
  the feed card already streams from a signed URL; the poster fix removes the
  black flash that reads as "slow".
- **Test**: typecheck; manual: video post cell shows poster on own + other +
  tagged grids.

### 6. Tag-a-friend sheets: black bar + keyboard gap (ts)
- **Root cause**: two pickers. (a) `PhotoTagOverlay` ("Tag a friend"):
  hand-rolled KeyboardAvoidingView panel, no bottom safe-area inset, KAV
  padding misplaces the panel → gap above keyboard + black strip at the
  bottom. (b) `FriendsSheet` (gorhom sheet): `keyboardBehavior="extend"` grows
  the sheet to 78% height while the list is fixed-height → dead graphite space
  between content and keyboard.
- **Fix**: PhotoTagOverlay: replace KAV with explicit keyboard-height tracking
  (same pattern as story.tsx) + `insets.bottom` padding when closed. Sheet
  host: `keyboardBehavior="interactive"` so the sheet floats above the
  keyboard at its content height instead of stretching.
- **Test**: typecheck; manual on device (keyboard behavior isn't testable on
  web): open both pickers, focus search, scroll list — no gap, no black bar.

### 7. Caption @mentions not tappable (ts)
- **Root cause**: caption is a plain nested `<Text>`; no mention parsing
  exists anywhere. (The "with @x" row IS already pressable.)
- **Fix**: `lib/mentions.ts` — pure splitter `splitMentions(text)`; PostCard
  caption and comment bodies render @handles bold/white + tap → `/user/[handle]`.
  This also delivers half of "tag in comments" (mentions render + link;
  autocomplete is deferred).
- **Test**: vitest unit for the splitter (edge cases: punctuation, start/end,
  emails not matched); typecheck; manual tap.

### 8. Tap the dual-camera inset to expand it (ts + emal, asked twice)
- **Root cause**: the corner inset in `PostMedia.tsx` is a bare `View`.
- **Fix**: make it pressable — tap swaps inset/main images (BeReal behavior),
  tap again swaps back. Accessibility label added.
- **Test**: typecheck; manual: tap corner → images swap.

### 9. Hold a story to fullscreen it (ts)
- **Root cause**: hold already pauses (`held` state) but chrome never hides.
- **Fix**: while `held`, fade out all chrome blocks (scrim, progress, header,
  reply bar / own-story bar, music chip) and disable their touches.
- **Test**: typecheck; manual: hold → clean fullscreen photo; release → chrome
  returns, story resumes.

### 10. Comments visually bigger (emal) + notifications bigger with post previews (emal)
- **Fix (comments)**: bump body 15.5→16/lh 22.5, author 14→14.5, input 13→15
  with taller padding, avatars 38→40.
- **Fix (notifications)**: rows: avatar 42→48, padding 12→14, text 13.5→14.5;
  fetch the related posts for notifications whose payload carries `post_id`
  (reaction/tagged/taunt_answered/second_workout), batch-sign their
  thumbnails, render a 40×50 preview on the row's right side.
- **Test**: typecheck; manual visual pass.

### 11. "Same as last" (emal)
- **Status**: within a session, Add-set ALREADY clones the previous row.
  The real gap is cross-session: a re-added exercise starts at 75%-of-PR.
- **Fix**: `deriveLastUsed()` — most recent completed values per exercise from
  workout history; Select Exercises seeds new entries from last-used values
  (fallback to the old suggestion).
- **Test**: vitest unit for `deriveLastUsed`; typecheck.

### 12. Taunt limit should reset at the daily drop (emal)
- **Status**: ALREADY midnight-based server-side (migration 20260816120000:
  `date_trunc('day', now() at time zone profiles.timezone)`, 5/day cap, 1 per
  target per day). Not a rolling 24h window.
- **Fix**: verify the deployed function matches the migration; the visible
  staleness is the client counter (30s stale, never invalidated at rollover) —
  refresh it on foreground; sync `profiles.timezone` from the device on app
  start so the server's "day" matches the user's.
- **Test**: live SQL inspection of `send_taunt_line`; typecheck.

### 13. Block users (emal)
- **Status**: backend exists (`block_user` RPC, settings → Blocked list,
  DM-thread menu) but there is NO block entry on a profile or a post — and the
  `is_blocked` RLS bug (item 1) meant blocks didn't enforce anyway.
- **Fix**: enforcement fixed in item 1; UI: add "Block @user" to the post "..."
  menu (ContentMenu) and a kebab menu on the other-user profile screen with
  Block / Report.
- **Test**: simulated-JWT SQL (blocked pair sees nothing); manual UI pass.

### 14. Reactions: front AND back camera (emal)
- **Root cause**: `ReactionCaptureSheet` hardcodes `facing="front"`.
- **Fix**: add a flip button; mirror the capture only when front-facing.
- **Test**: typecheck; manual.

---

## Round 2 — deferred features (approach sketched, not built this round)

| Ask | Why deferred | Sketch |
|---|---|---|
| Drop sets (workouts + free weight) | Needs set-model change + UI design | Add `dropOf` link or `drops: [{w,r}]` on `LiftSet`; long-press ✓ → "Add drop set" pre-filled at −20%; renders indented under the parent set. |
| Comment @mention autocomplete | Mentions now render/link (item 7); autocomplete is a picker UI | `@` in the comment input opens an inline friends list; insert handle on pick. |
| Add posts to stories | New share path + story rendering of post cards | "Add to story" in the post ... menu → composes post image into a story with attribution chip → `shareStory`. |
| Group chats in DMs | Schema redesign (`conversations` are 1:1 pairs) | `conversation_members` table, group title/avatar, fan-out unchanged via RLS; new-chat sheet gets multi-select. |
| Custom notifications | Prefs screen already exists (settings → notifications) | Extend `useNotificationPrefs` with per-type toggles honored by the push edge function. |
| Dual camera more prominent | Design decision; today it's a 40×40 icon top-right | Promote to a labeled pill next to the shutter ("DUAL") or make dual the default daily mode. |
| "Workout option outside workout below home gym" | Ambiguous — needs clarification | Reading: on the camera location/compose sheet, surface the workout-attach option directly below Home Gym instead of inside the workout flow. |
| Bigger overall notifications redesign | Item 10 covers size + previews | — |

## Verification loop per item
1. `npx tsc --noEmit`
2. `npx eslint <touched files>`
3. `npm test -- --silent` (vitest; add units where logic is pure)
4. DB items: apply via Supabase MCP `apply_migration`, mirror into
   `supabase/migrations/`, verify policies with simulated-JWT SQL in a
   rolled-back transaction
5. Device-only behaviors (keyboard, camera, stories) flagged for phone testing
