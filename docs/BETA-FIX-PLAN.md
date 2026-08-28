# Beta feedback — fix plan (Discord, 19 Aug)

18 items from the four screenshots, grouped so related code is touched once.
Ordered by severity, then by blast radius. Each item notes what was actually
verified in the codebase, not just what was reported.

Legend: **[S]** small (<1h) · **[M]** medium · **[L]** large / needs a decision

---

## P0 — Crash / data-loss

### 1. Deleting a comment "bricks the app" **[S]**
**Reported:** ts — "If someone comments on your post and you click 'delete', it bricks the app"

**Verified cause.** `CommentsSheet` renders inside its own `<Modal>`
(`components/post/CommentsSheet.tsx:174`). The delete confirm uses `appAlert`,
whose host is mounted at the app root *outside* that modal
(`app/_layout.tsx:302`). Stacking a second native Modal over a presented one is
the same failure class as the report-sheet-behind-post bug fixed earlier: the
dialog never becomes visible but its backdrop swallows touches, so the screen
freezes.

**Fix.** Confirm inline, inside the sheet's own tree — a local
`pendingDelete` state rendering an in-sheet confirm row/overlay — instead of
calling `appAlert` from within a Modal. Delete mutation itself is fine
(`usePostComments.ts:105`, optimistic + rollback).

**Test:** comment on own post → Delete → confirm → row disappears, app responsive.

---

## P1 — Broken interactions

### 2. Can't react to images in group chats **[S]**
**Reported:** emal

**Verified cause.** The reaction menu opens from `onLongPress` on the row
wrapper (`app/chat/[id].tsx:704`), but `ChatMediaBubble` puts its own
`RNPressable onPress` around the image (`:249`) with **no `onLongPress`**. The
inner pressable wins the responder, so long-press never reaches the wrapper.
Affects 1:1 too, not just groups.

**Fix.** Thread `onLongPress` (+ `delayLongPress={220}`) into the inner
pressable in `ChatMediaBubble`; same for `VideoBubble`/`ViewOnceBubble` if they
have the same shape.

### 3. Exiting images in group chats is buggy **[S]**
**Reported:** emal — "should be able to only press x and tapping it shouldn't make it go away"

**Verified cause.** `ChatPhotoViewer` (`app/chat/[id].tsx:211`) wraps the whole
image in `Pressable onPress={onClose}` → any tap closes. The X badge is
`pointerEvents="none"` (`:217`) → decorative, not a button. Exactly inverted
from what's wanted.

**Fix.** Make the X a real `Pressable` that closes; remove close-on-image-tap
(keep backdrop tap outside the image if desired).

### 4. Stories: swipe up should reply, not close **[M]**
**Reported:** screenshot 4

Swipe-up currently closes the story. Wanted: swipe-up opens a reply composer
that DMs the poster. Needs the story screen's vertical gesture split (down =
close, up = reply) and a send path into the existing DM send.
*(Gesture/reply-path specifics being confirmed in `app/story.tsx`.)*

---

## P2 — Wrong / missing content

### 5. Dual-camera photo missing from profile grid **[S]**
**Reported:** screenshot 1

**Verified.** The data is already there and signed — `SignedPost.inset_url`
(`hooks/queries/useSignedUserPosts.ts:72,82`) — but every grid drops it:
`profile.tsx:440` passes only `{media_url, media_type, thumbnail_url}` to
`GridCell` (`:577`), and `user/[username].tsx:451` passes only `{uri,isVideo}`
to `GridCellMedia` (`:623`).

**Fix.** Pass `inset_url` through and render a small corner PIP in both cell
components (mirror `components/post/PostMedia.tsx:53,71`). Note `GridCell`
prefers `thumbnail_url` over `media_url` — PIP goes over whichever is shown.

### 6. Dual-camera photo missing from profile calendar **[S]**
**Reported:** emal — "Sometimes the dual camera images don't show up in your profile calendar"

**Verified cause (and the "no correlation" explanation).** The calendar query
never fetches the inset at all: `useStreakDays.ts:31` selects
`post:post_id(media_url)` only. So it's not intermittent — a dual post whose
*main* image is the selfie-less frame simply shows that frame. Same one-PIP fix
after adding `inset_url` to the select + signing.

### 7. Split shows REST when you posted but didn't log a workout **[M]**
**Reported:** emal — "It should show up as workout not listed"

`WeeklySplit` classifies a past day with no logged workout as REST. It needs to
distinguish "posted, nothing logged" from "genuine rest day". Requires feeding
gym-day/post presence into the component.
*(Data-availability check in progress.)*

---

## P3 — Reactions sheet

### 8. Reactions sheet layout is wrong **[S]**
**Reported:** screenshot 1 — left circle should be the *profile picture*, right should be the *reaction photo*

**Verified.** Today the **same reaction selfie renders twice**:
`ReactionsSheet.tsx:52-58` puts it in the left 46px circle (avatar only as a
dead fallback — the query filters `media_url is not null`,
`usePostReactionSelfies.ts:38`), and `:62-70` repeats it at 30px on the right.

**Fix.** Left circle → `Avatar` (profile picture, always). Right → reaction
photo.

### 9. Reaction photo should enlarge on tap **[S]**
No handler exists — the whole row is one `Pressable` → opens profile
(`ReactionsSheet.tsx:71`). Add a tap target on the photo that opens a
full-screen viewer; reuse the existing avatar-zoom modal pattern
(`app/user/[username].tsx:552`). Row tap keeps opening the profile.

### 10. Reaction image ~50% larger by default **[S]**
30px → ~45px in the row.

---

## P4 — Map tab

### 11. Search bar in the map/gym-list tab **[M]**
**Reported:** ts + Ryan — reuse the home-gym search (`components/profile/HomeGymSheet.tsx`,
which already debounces `useGymSearch` with distance sorting).

### 12. Can't zoom out far enough **[S/M]**
Region/zoom constraints in `app/(tabs)/map.tsx`.

### 13. Communities still prompted from the map **[S]**
Remove the leftover community nudge from the Map tab.
*(11–13 specifics being confirmed.)*

---

## P5 — Streaks & rest days

### 14. Rest / recovery day on the daily post **[L]** ← needs a product decision
**Reported:** Ryan, twice ("rest day option on daily post to keep streaks
active", "add recovery days")

**Verified constraints.** `gym_days(user_id, day, post_id)` has no kind/type
column and there is **no** rest/recovery table. Streaks are computed **twice**:
client-side `computeGymStreak` (`lib/streak.ts`, consecutive `gym_days`) *and*
server-side (`streak_tick_sweep`, `update_streak_on_checkin`,
`record_streak_high_water`, `keep_longest_streak`). Both must agree or streaks
will disagree between screens.

**Proposed shape.** Add `gym_days.kind` (`'gym' | 'rest'`, default `'gym'`);
rest days preserve streak continuity but are excluded from gym-day counts,
trophies, and the "gym streak" stat; cap rest days (e.g. 1–2/week) so the
streak still means something. Calendar/split render them distinctly.

**Open question for you:** should a rest day *extend* the streak, or only
*freeze* it (not break, not increment)? "Freeze" protects the meaning of a
streak; "extend" is friendlier. This changes the DB and both streak paths, so
I'd like your call before building.

---

## P6 — Social

### 15. "Pending" friend-requests tab **[M]**
**Reported:** ts — show both requests you've **sent** and requests sent **to you**.
Incoming exists (`useIncomingRequests`); outgoing needs a hook + UI.
*(Confirming what exists.)*

### 16. Home gym is hard to change / can't remove **[S]**
**Reported:** Ryan — "can't get eos off of my profile page"

**Verified.** The feature *does* exist and works (Edit profile → Home gym →
Remove home gym, `HomeGymSheet.tsx:110`, saved at `edit-profile.tsx:155`) — he
was on a build that predates it. Remaining real issue is **discoverability**:
the gym line on the profile (`profile.tsx:246`) is inert text.

**Fix.** Make the profile gym line tap through to Edit profile. Low risk.

### 17. Can't edit or add stuff over a dual photo **[M]**
**Reported:** Ryan

**Verified cause — it's broader than dual.** The editor is hard-gated to
non-daily: `camera.tsx:1802` `if (editing && photoUri && mode !== "daily")`,
and every `setEditing(true)` is story-only (`:1484`, `:1555`, `:2192`, `:2260`).
So a **daily** post has no edit affordance at all. Dual is only stored as a real
`inset_url` in daily mode (`:1738`).

**Care needed.** Stories *bake* the inset into the JPEG
(`PhotoEditor.tsx:550-568` inside `captureViewRef`). If daily editing were
enabled the same way, the separately-uploaded `inset_url` would render the PIP
**twice**. So: either keep the inset as a non-captured overlay while editing, or
stop uploading `inset_url` when the daily photo was edited. Inset placement also
differs between editor (`top: insets.top+66, left:16, 30%`) and feed
(`12/12, 31%`) and must be unified.

---

## P7 — Data

### 18. US gym coverage, especially the south **[L]**
**Reported:** Ryan — "we need all gyms in the US updated. Especially in the south near my school"

**Verified gap** (gyms per state):
`MS 41 · OK 80 · AR 85 · KY 88 · LA 105 · AL 135 · TN 138` versus `CA 1122 · TX 863`.
Real hole, not a perception problem.

**Approach.** Same OSM Overpass → dedupe → insert pipeline used for the
University of Utah pass (which is proven: real footprint centroids, `type/id`
external ids, `on conflict (external_id) do nothing`, existing unique dedupe
indexes). Run per-state for the southern tier, `category='gym'` so
`search_gyms()` returns them.

**Ask:** which school is Ryan's? Targeting that metro first is a much better
first delivery than a slow national sweep.

---

## Status (updated after implementation pass 1)

DONE — verified with tsc + eslint + 92/92 tests:
1. Comment-delete freeze (inline confirm, no stacked modal)
2. React to images in chat (long-press now reaches the menu)
3. Image viewer exit (X is a real button; tapping the photo no longer closes)
4. Story swipe-up reply (pager was stealing the vertical gesture)
5. Dual photo in profile grids (own + other user)
6. Dual photo in the streak calendar (inset was never even fetched)
7. Split "WORKOUT NOT LISTED" vs REST
8/9/10. Reactions sheet: avatar left, reaction right, +50% size, tap to enlarge
11. Gym search bar on the Map tab
12. Map zoom wall (gym layers hid below z7 → lowered to z5; also fixed a
    use-before-declare that made the first fetch work only by accident)
13. Communities prompt removed from gym pins (now Set as home gym / View gym)
15. Pending sent-requests section + withdraw
16. Home gym reachable straight from the profile

PLUS one regression found from live feedback mid-pass:
- Seeing YOURSELF in a friends list with an "Add" button, which errored. The DB
  has always had CHECK (user_id <> friend_id), so the server was right to
  reject it — the row just shouldn't offer the action. Own row now reads "You".

REMAINING (open questions, see below):
- 14 rest/recovery days — needs the freeze-vs-extend decision
- 17 editing a daily photo — needs the double-PIP decision
- 18 US/southern gym import — needs Ryan's school

## Suggested order

1. **P0 #1** comment-delete crash
2. **P1 #2, #3** group-chat image react + viewer exit (same file, one pass)
3. **P2 #5, #6** dual photo in grid + calendar (same PIP treatment)
4. **P3 #8, #9, #10** reactions sheet (one component)
5. **P6 #16** home-gym discoverability
6. **P4 #11, #12, #13** map tab
7. **P2 #7** split "workout not listed"
8. **P6 #15** pending requests tab
9. **P1 #4** story swipe-up reply
10. **P6 #17** daily photo editing (needs the double-PIP decision)
11. **P5 #14** rest days (needs your product call)
12. **P7 #18** gym import (needs Ryan's school)

Items 1–9 are unambiguous and I'll implement them in order. 10–12 have open
questions noted above.

---

# Round 2 (20 Aug) — live reports

Reported directly by octav plus a second Discord sweep. Every item below was
root-caused before it was touched; several turned out to be different bugs than
the symptom suggested.

## Shipped

### R1. Feed posts render as blank dark cards
**Reported:** "some of these posts aren't loading well in the feed"

**Verified cause.** Not a data problem — the row was healthy (`approved`, valid
R2 paths). `signedPostUrls` (`lib/supabase.ts`) retried the *Supabase Storage*
branch twice but the *R2* branch **not at all**, and `invokeR2`
(`lib/r2.ts`) reports failure by returning `null` → `r2SignDownloads` hands back
an **empty map instead of throwing**, so the surrounding `catch` never fired and
the loop "succeeded" with zero URLs. One edge-function cold start or transient
5xx therefore blanked every R2 photo on a page, permanently until a refetch.
Since essentially all media is now R2, that reads as "random posts won't load".

Blank looks *dark* rather than obviously broken because every `FEED_SCENES`
placeholder gradient is a dark grey (`#2E2E33`, `#17171A`, …).

**Fix.** Retry the R2 branch per chunk, driven off what is *still missing*
rather than off exceptions (so it covers a throw and a silent empty alike), with
a short delay before the second attempt. `invokeR2` now logs `r2_invoke_failed`
so this is diagnosable instead of silent.

### R2. Images take forever to load
**Verified cause.** `r2-media`'s `download` action presigned keys in a **serial
`for await` loop**. Each presign awaits `crypto.subtle` HMACs, so a feed page
(~40–60 keys across media, insets, thumbnails and carousel frames) waited for
every signature in turn before *any* image could start downloading — and
batches near the 200-key cap ate the function's ~2s CPU budget.

**Fix.** `Promise.all` — they are independent pure-crypto operations. Deployed
as r2-media v7.

### R3. Music slider crashes the app (posts AND stories)
**Verified cause.** `MusicClipScrubber` reports each new second to the parent,
which owns `clipStart`, so the parent re-renders ~25× **during an active drag**.
The gesture was built inline (`Gesture.Pan()` on every render), handing
GestureDetector a brand-new gesture object mid-gesture and forcing a native
handler teardown/reattach — the crash. Both post and story music go through this
one picker, which is why it reproduced in both.

**Fix.** Build the gesture **once**: callbacks behind a ref, geometry in shared
values, `useMemo` with only stable deps. Also hardened `safeSeekPlay` to bail
unless the player `isLoaded` and to clamp the target inside the real duration
(the previous `try/catch` could not catch a native assert).

### R4. Voice notes don't send in DMs or groups
**Verified cause.** They have **never** worked. The `messages` storage bucket's
`allowed_mime_types` listed only image and video types — no audio at all — so
Storage rejected every recording. The client compounded it by declaring
`audio/m4a`, which is not a real MIME type (an .m4a is MPEG-4 audio,
`audio/mp4`), and the allow-list matches on the exact string.

**Fix.** Bucket now allows `audio/mp4`, `audio/x-m4a`, `audio/m4a`, `audio/aac`,
`audio/mpeg` (migration `20260819060000`); client sends `audio/mp4`.

### R5. "Sometimes it won't let you add friends back"
**Verified cause.** `app/people/[type].tsx` guarded adds with a **single global**
`pendingAdd` string (`if (… || pendingAdd) return`). While any one add was in
flight, Add on *anyone else* silently no-oped; if a mutation never settled, every
Add on the screen stayed dead until you navigated away. Hence "can't find a
reason".

**Fix.** Track pending adds **per person** (a Set), which is what the existing
`busy={…}` prop already implied.

### R6. Keyboard stays up after posting a comment
**Fix.** The explicit Post button now dismisses. The return-key path
deliberately does not — that one is for firing off several comments in a row.

### R7. Boring spinner on launch
**Fix.** New `AppSplash` — the mark at the **same 180px on the same black as the
native splash**, so the native→JS handoff has no visible jump, with a slow
breathe and the wordmark at the bottom (the Instagram pattern). No spinner: a
spinner with no real progress reads as "broken", not "opening".

### R8. Gym search missed accented names
Covered by migration `20260819050000`: "EOS Fitness" never matched the real
"EōS Fitness" (0 mi) while a branch 5.7 mi away won. 303 of 25,072 gyms have
non-ASCII names. `search_gyms` now unaccents both sides, with matching trigram
expression indexes so it stays index-backed.

## Already shipped in round 1 (re-reported from older Discord scrollback)

Dual photo in profile grid · dual photo in streak calendar · reactions sheet
layout + tap-to-enlarge + larger · story swipe-up reply · pending friend-requests
tab · map search bar · map zoom-out · communities prompt removed · comment-delete
freeze · home gym reachable from profile · react to chat images · chat image
viewer exit · split "workout not listed" · self-row in others' friends lists.

## Decisions taken (20 Aug) and built

### #14 Rest / recovery days — FREEZE
Chosen: a rest day **stops the streak breaking but does not increment it**, so
the number keeps meaning "days you actually trained" (5 + rest = 5, then 6).

Built:
* `gym_days.kind` ('gym' | 'rest') — rest days share the one ledger, so the
  calendar, split, streak and trophies cannot disagree.
* `record_gym_day` now converts a rest day back to a gym day if you do post.
* `mark_rest_day(p_rest)` RPC. Guarded, because a spammable freeze is worthless:
  own ledger only (no user parameter — `auth.uid()` only), local **today** only
  (no backfilling gaps to resurrect a lapsed streak), never overwrites or
  deletes a real post, and **max 2 rest days per rolling 7 days**.
  Verified against a simulated JWT in rolled-back transactions: `already_posted`,
  `not_a_rest_day`, `rest_cap_reached` all fire, and the real post row survives
  a clear attempt intact.
* `computeGymStreak` takes rest days and bridges the run without counting them;
  a run of nothing but rest days is not a streak. 6 new tests (98 total).
* Trophies count real gym days only. Calendar shows a rest day as a quiet moon
  on a slate ring — never the gold photo cell — and the month header excludes
  them from "N gym days".
* Entry point: "Taking a rest day" on the lock overlay. It does **not** unlock
  the feed — seeing friends' drops still costs a drop.

**Assumption to confirm:** the 2/week cap is mine, not something you specified.
It's one constant in the migration if you want it looser or tighter.

### #17 Editing a daily photo — OVERLAY, don't bake
Chosen: show the dual selfie while editing but keep it out of the capture.

Built: `PhotoEditor` gained `bakeInset`. Stories still bake (a story is one flat
image). Daily posts render the PIP **outside** the captured view, so the selfie
is stored exactly once in `inset_url` and the feed/grid/calendar keep drawing it
live — no double PIP, and the PIP stays swappable and tappable. The daily
review photo is now tap-to-edit, matching stories. Publish still passes
`insetUri` independently, so an edited dual post keeps its inset.

## Still open

### R9. Streak calendar fired ~1000 sequential sign requests
Found while wiring rest days: `useStreakDays` awaited `signedPostUrl` **per
path inside its loop**, and that helper signs a SINGLE key per call. A year of
posts meant up to ~1000 sequential edge-function round trips before the
calendar could render — a second major contributor to "images take forever".
Now one batched `signedPostUrls` call.

## Still needs input from you



### #18 US / southern gym import — investigated, mostly a FALSE ALARM
Ryan's school was given as "Auburn, in Texas". Auburn University is in Auburn,
**Alabama** — there is no Auburn University in Texas.

Checked Auburn AL anyway, and the coverage there is fine:
* **58 gyms within 12 km**, including the campus Recreation and Wellness Center
  at 0.21 mi, plus Gold's, Crunch, Planet Fitness, Orangetheory, F45, Iron
  Tribe and several CrossFits.
* Independent OSM Overpass sweep of the Auburn–Opelika bbox returned 15
  fitness venues; **14 were already in the database**. The one genuine gap,
  Xtreme Athletics (node/10136543824), has been added.

So "we need all gyms in the US updated" was almost certainly a DISCOVERABILITY
problem, not a data problem — and Ryan half-said so himself ("you should be able
to zoom out further… but I guess with the search bar we may not need that").
Both causes are now fixed: the map search bar (#11), the zoom wall that hid gym
pins below z7 (#12, now z5), and the accent bug (R8) that hid any gym with a
diacritic in its name.

**Still worth confirming:** the NAME of the gym Ryan can't find. That resolves
it in one query, versus a speculative multi-state import.

### Bonus: 15 duplicate gyms removed
OSM frequently carries a venue as BOTH a node (POI point) and a way (building
footprint); the importer took both, so 15 gyms existed twice (e.g. Lake Wilmore
Park Recreation Center, two rows 40 m apart). Verified none of the removed rows
was referenced by any post, profile home gym, check-in or community before
deleting. 25,072 → 25,058 gyms.

### R10 — "I ran out of suggested friends after 26 X's" (20 Aug)

Not a bug in the pool. For @octavio the 64 profiles account for exactly:
1 self + 11 friends + 7 pending + 19 hidden-from-discovery + **26 suggestible**.
He X'd 26, i.e. every eligible person. `get_friend_suggestions(..., 40)` still
returns all 26 (dismissed rows sort last but are returned); the empty screen was
the CLIENT's session-local `dismissed` Set, which never cleared.

The real defect was the empty state: it said "No suggestions right now. Search
for friends by name or handle." — indistinguishable from an app with nobody in
it. Now `cycledThrough` (eligible === 0 while the pool is non-empty) renders
"That's everyone for now." plus **Start over**, which deletes your
`suggestion_dismissals` rows (RLS `..._delete_self`, no RPC needed) and un-hides
locally. People you ADDED stay hidden — their "requested" relationship state
filters them regardless.

Note on the 19 hidden: `discoverable` defaults to **true** and no trigger or
onboarding path writes it — all 21 app-wide were set in Settings > Privacy by
hand, and all 21 are also `is_private` (0 public accounts turned it off). The
misleading copy that likely caused it is already corrected; re-prompting those
users is a product call, not a code change.

### R11 — "Liked by <name> and N others" (20 Aug)

`usePostLikers` was already fetched per card for the heart count, so the line
costs **zero extra requests** and the sheet it opens shares the cache key, i.e.
opens with no loading flash. `lib/likeSummary.ts` picks the lead name: you →
a friend → most recent liker (9 tests). Two likers get both names, IG-style.
The bare number next to the heart was removed — the count now appears once.
`useFriends()` in PostCard is one shared query for the whole feed, not per card.

### R12 — Trophies that "require video verification" (21 Aug)

The premise was inverted: nothing required video. `deriveAchievements` grants any
stacked tier once `stats.numbers[statKey]` clears it, and `useTrophies` fills
`benchMax`/`squatMax`/… straight from `user_lifts` — the honour-system number you
type when logging a lift or finishing a workout. `verifyLift()` was never called
by app code; only a test imported it.

So the 5 strength trophies were auto-earning from a typed number while their
cards read "Verify a bench press on video." Decision (octav): keep the trophies,
delete the video framing. `trackingType: "videoVerification"` → `"progress"` (so
they now show a real progress bar), `VerificationType` loses `"video"`, the
"Tiers unlock when a max-lift video is verified" banner is gone, `lib/verifyLift.ts`
is deleted, and the tier requirement builder now spells out the unit ("225 lb",
not "Hit 225"). A test asserts no trophy copy anywhere contains "video"/"verif".

### R13 — "Dual camera posts don't show in my profile" (Ryan, 21 Aug)

Not dual-specific — a **stale cache**. Publishing invalidated only `["feed"]`.
The profile grid, post count and streak calendar read `["user-posts"]` /
`["signed-user-posts"]` / `["streak-days"]`, none of which were invalidated, and
the query cache is persisted to AsyncStorage, so the pre-post list survived
relaunches. It only self-corrected on a profile pull-to-refresh or after
finishing a workout. Ryan's last non-dual post was 17 Aug and everything from
19 Aug on happened to be dual, so the stale cut looked like "dual posts don't
show". Fixed with `invalidateAfterPostChange()` in lib/queryClient.ts, used at
all four post-creation sites (camera daily, camera lift, offline-queue flush,
legacy CameraScreen).

Second bug found in the same path: `useUserPosts` signed `media_url` per post
(up to 240 individual round trips per archive) and wrote `""` on failure —
which `useSignedUserPosts` reads as `hasMedia: false`, and BOTH profile grids
drop `!hasMedia` posts. One flaky signing call therefore made a real post
disappear instead of showing a placeholder tile. `useUserPosts` now returns raw
paths; the batched, retrying `signedPostUrls` in `useSignedUserPosts` was
already signing everything a second time anyway.

### R14 — "Image quality for posts is still shit" (21 Aug)

Root cause was upstream of compression: **the camera session was pinned to
`mode="video"` for every flow**, so a daily post's tap-to-shoot came back as a
1080p VIDEO FRAME (1080x1920, video-grade ISP — no Smart HDR / Deep Fusion),
not a photo. In a gym's dim mixed lighting that gap is enormous. It had been
pinned that way because a picture-mode session made hold-to-record hang
recordAsync forever.

Fixed by making the session follow INTENT instead of being pinned: daily sits in
`"picture"` (full ~12 MP sensor) for the tap, and `startRecording` flips to
video before recording, clearing `videoReadyRef` first so the existing readiness
wait covers the reconfigure — the same handshake the dual-camera lens flip
already uses. Story/lift are unchanged (already video, so no remount, recording
still starts instantly).

Knock-on that had to be fixed with it: the photo session's preset is **4:3**
where video is 16:9, and the crop-mask math hard-coded `SENSOR_RATIO = 9/16`.
The mask is also computed from the aspect-FILLED preview, which hides whatever
overflows the screen sides — so the old crop kept the full sensor width and
posted an 18% horizontal overshoot on video (38% on 4:3) that the user never
saw. `captureCropRect` (extracted to lib/captureCrop.ts, 8 tests) now trims to
the visible region AND the post ratio in one crop, and the mask reduces to
`winW / POST_PHOTO_RATIO` — no sensor term, correct for any preset.

Also in this pass:
- `MAX_UPLOAD_WIDTH` 1080 → **1440**. The feed photo is full-bleed, so at @3x it
  paints ~1170px — a 1080 upload was being upscaled on every modern iPhone, and
  posts are pinch-zoomable on top of that. R2 egress is free, and grids still
  ride the 320px thumbnail.
- `JPEG_QUALITY` 0.85 → **0.9** (0.85 rings on equipment edges / bands in flat gym light).
- **PhotoEditor no longer screenshots the photo when nothing was edited.**
  `renderEditedPhoto` always ran `captureRef`, which rasterises the VIEW — so it
  capped the photo at on-screen size (~1170px @3x, ~780px @2x) and re-encoded
  it, even for a user who opened the editor and changed nothing. Now it returns
  the original URI unless there are strokes/text/stickers/a crop transform/an
  inset to bake, and when it does capture it uses quality 1 (lib/posts
  re-encodes on upload anyway).
- Dual capture used `quality: 0.9` where the single-shot path used 0.95 — a dual
  post's main frame is a full post photo, now encoded to match.

### R15 — "Adding a song to a post makes me do it two separate times" (21 Aug)

The picker's row tap only AUDITIONED a song: it marked the row `selected` and
started playing it — so it looked and sounded chosen — but the value was held in
the sheet's local `chosen` state and only handed to the post by the "Add to
post" button. Dismissing the sheet (swipe down, or tap the backdrop, which has
`pressBehavior="close"`) threw it away silently. The post came back with no
music and the whole selection had to be redone: two separate times.

`MusicSheet` now commits on dismissal. A single `commit()` guarded by a ref is
the one exit point for all three paths (Add to post / No music / dismissed), so
the pick can't double-fire when the button both commits and closes. Commit-on-
dismiss is also gentler than Instagram/Snapchat, which apply the song on the row
tap itself.

### R16 — "Save past workouts and use them again" (Ryan, 21 Aug)

The logger already had `/workout?edit=<id>` hydration from a saved row, so the
feature is a second mode rather than a new table — no `workout_templates`
schema, nothing extra to keep in sync.

`/workout?repeat=<id>` starts a NEW session shaped like a past one.
`repeatableExercises()` (lib/repeatWorkout.ts, 11 tests) keeps the exercises,
order and last time's weights/reps as targets, and clears what belonged to that
session: nothing pre-checked, PR flags dropped (they'd re-fire the celebration
for lifts not done yet), and never-completed sets removed so an abandoned 5th
set doesn't become part of the routine. Repeat leaves `editingId` null, so the
finish path inserts instead of overwriting the original row.

Two entry points: "Do this workout again" on the workout detail screen (own
workouts only — a friend's workout is a record, not a routine), and a "DO IT
AGAIN" list of the 3 most recent routines on the empty logger screen, which is
where a session actually starts. That list dedupes by exercise SET rather than
name, so logging "Push Day" three times doesn't fill it with three copies.
Auto-generated names ("Workout", "Evening Workout") don't carry over; a real
name like "Push Day" does.

### R17 — "A mistyped weight is still recorded as a max after changing it" (21 Aug)

Reproduced from Ryan's data. Workout `e786bd80` stored
`prs: [{name: "Machine Chest Press", value: "490 lb", was: "was 180 lb"}]`
while that workout's actual Machine Chest Press sets were **180/180/190/190**.

Cause: the live PR detector (`toggleDone` → `session.recordPR`) fires the moment
a set is checked and APPENDS to a running `sessionPRs` list, bumping
`bests[name]`. Nothing ever unwound that entry — not correcting the weight, not
unchecking the set. `useSaveWorkout` then persisted the accumulated list
verbatim, and `useUpdateWorkout` explicitly carried `prs` through an edit
untouched ("Original session PRs — preserved through the edit"), which is the
exact path a user takes to fix the typo.

Fix: PRs are now DERIVED from the final sets rather than accumulated
(`lib/sessionPRs.ts` — `derivePRs` + `applyPRFlags`, 13 tests). Applied on both
the finish path and the edit path, so a correction is self-healing rather than
requiring every edit path to reverse itself. `applyPRFlags` also re-stamps the
per-set PR badges so a corrected set can't keep a badge it no longer earns, and
badges only the FIRST set that reaches the record. The prior-bests baseline now
excludes the workout being edited — otherwise its own sets are the record to
beat and nothing in it could ever read as a PR.

The in-session celebration stays event-driven: it's a moment, not a record.

Scope check: `user_lifts` (which feeds strength trophies) was NOT affected —
`useSaveWorkout` already recomputed `sessionBest` from the current sets at save
time, and "Machine Chest Press" isn't a canonical lift. Audited every workout in
the DB for a stored PR exceeding its own best completed set: exactly one row
app-wide (Ryan's), corrected in place to `190 lb`.

### R18 — Named saved routines (21 Aug)

Follow-up to R16: routines you build and pin, independent of history.

New table `workout_routines` (migration 20260821010000) rather than a flag on
`workouts` — history rows carry times, volume and PRs and feed stats, streaks
and feed slides, so a template living there would have to be excluded from every
one of those queries. Owner-only RLS on all four verbs (verified: a second user
sees 0 of another's routines), a `name` length check, a `jsonb_typeof = array`
guard on `exercises`, an `updated_at` touch trigger, and a 50-routine cap
enforced by trigger so a client loop can't run the table away.

`hooks/queries/useRoutines.ts`: list (most-recently-used first), fetch one,
save, rename, delete (optimistic), and `markRoutineUsed`. Routines are saved
through `repeatableExercises()` so they store a plan — nothing checked off —
rather than a copy of the session.

UI: "Save as routine" on the workout detail screen (under "Do this workout
again"), and a gold-bordered "MY ROUTINES" section on the empty logger with
start / inline rename / delete. `/workout?routine=<id>` starts one and stamps
`last_used_at`.

Note: `.expo/types/router.d.ts` was found corrupt (truncated mid-token with a
duplicated tail — concurrent writes from a dev server). It's a gitignored build
artifact; deleted, and Expo regenerates it on next start.

### R19 — "Select a song and click save, it makes me select a song again" (21 Aug)

Second report of the music picker losing a pick, so the fix goes further than
R15's commit-on-dismiss. Likely mechanism, from the sheet's own layout: the
picker sits inside a `TouchableWithoutFeedback` keyboard dismisser, and the
sheet host runs `keyboardBehavior="interactive"`. After searching (keyboard up),
the tap meant for "Add to post" first dismisses the keyboard, which re-lays-out
the floating sheet and slides the button out from under the finger. The sheet
stays open with the song still merely "chosen" — indistinguishable from having
to pick again.

Rather than chase which tap was swallowed, selection now commits LIVE:
`auditTrack` hands the track to the post via a new `onChange` prop the moment
the row is tapped (the row already renders selected and starts playing, so the
choice has visibly been made), and dismisses the keyboard right then so the
layout settles before the user reaches for any button. The clip scrubber's
`onCommit` pushes the updated clip start the same way. "Add to post" is now only
a close, and R15's commit-on-dismiss remains as a backstop.

### R20 — "Choosin' Texas by Ella Langley listed 3 times" (21 Aug)

`searchTracks` deduped on iTunes `trackId`, which is a RELEASE id, not a song
id. Verified against the live API: that exact search returns **five** Ella
Langley rows for the one song — the single, two `Dandelion` album cuts, and two
remixes — each with a distinct trackId, so nothing was collapsing.

`lib/musicDedupe.ts` (dependency-free, 11 tests) keys on artist + normalised
title instead, reusing the existing `normTitle` that already strips
"(feat. …)" / "(Deluxe)" / "[Mixed]" decoration. Collision resolution keeps the
best release: playable first (no preview = can't be auditioned or played on a
post), then the plain release over a remix of the same title, then the explicit
original over its cleaned edit — while holding relevance/chart order.

Applied to all three feeds (search, chart pages, recommendations), plus a
cross-section pass in MusicSheet so a song under RECOMMENDED can't reappear a
few rows down under TOP SONGS.

### R21 — "Dual camera posts don't stay on ur profile" (21 Aug)

Audited the data: all 6 of Ryan's posts have rows, media paths, thumbnails,
`gym_days` entries and `moderation_status: approved`, and the posts RLS
short-circuits on `user_id = auth.uid()` so expiry never hides your own. Nothing
is disappearing server-side.

The "appears, then doesn't stay" shape matches the R13 signing bug precisely:
`useUserPosts` signed each post's media individually (2 calls/post, up to 240 per
archive) and wrote `""` on failure, which `useSignedUserPosts` reads as
`hasMedia: false` — and both profile grids DROP `!hasMedia` posts. Under a burst,
which posts failed varied per fetch, so posts flickered in and out. Already
fixed in R13 (raw paths + one batched, retrying sign).

Hardened further here: a grid cell with no signed URL now renders an ImageOff
placeholder instead of an empty graphite tile, so a transient signing failure
reads as "photo didn't load" rather than "my post vanished".

### R22 — Duplicate "Choosin' Texas" in TOP SONGS TODAY, round 2 (23 Aug)

R20's dedupe was right but the duplicates weren't coming from search — they were
in the CHART FEED, and the count gave it away: five copies, five days stored.
`useTopSongs` queried `music_chart_daily` ordered by rank with **no day
filter**, and the table keeps a rolling week (refresh-music-chart prunes at
7 days). So rank 0 of every stored day came back adjacent: the #1 song appeared
once per stored day, growing toward 7 copies. The recommendations RPC already
filtered `day = max(day)`; only the client chart query forgot.

Fix: each page first resolves the latest stored day (not the device's local
date — the refresh job's clock and the user's timezone needn't agree, and a
stale-but-real chart beats an empty sheet) and pins `.eq("day", …)`. The
client-side dedupeTracks from R20 stays as the lookalike-release guard.

### R23 — Notification says "2 day streak", profile says 7 (23 Aug)

Two streak systems had drifted apart. The profile computes from the `gym_days`
ledger (lib/streak.ts — rest days bridge without counting). The daily nudge
read the LEGACY `streaks` table, maintained only by a trigger on `checkins`
(naive consecutive-calendar-days, no rest-day concept, and a data source daily
posts don't reliably feed). Measured drift: ryan 0 vs 8, tyler 2 vs 8, ethan
1 vs 8 — wrong for basically every active user, not just rest-day users.

Fix (migration 20260823010000, applied):
- `gym_streak_count(p_user, p_tz)` — SQL mirror of computeGymStreak: anchor on
  today-if-covered else yesterday (grace window), walk back while covered,
  count only kind='gym', pure-rest run = 0. Verified in rolled-back tests:
  bridged run = 7, pure-rest = 0, UTC+14 grace correct; live spot-checks match
  the ledger for all heavy users.
- `daily_nudge_sweep` now uses it, derives "broke yesterday" from the ledger,
  and SKIPS the nudge entirely when today is a declared rest day — "don't
  break it today" to someone who already marked rest is nagging.

Left alone deliberately: `streak_tick_sweep` / `streak-tick` (the
streak_break_friend path) still runs on the legacy checkins/workout_schedule
system — it only fires for users with a workout_schedule, which barely exists
in practice. Flagged for a later decision: either port it to the ledger or
retire it.

## Round 3 (24 Aug) — Discord batch (Ryan M + emal)

Already fixed in earlier rounds, no action: photo quality (R14), song-twice
(R15/R19), saved workouts (R16/R18), 490 lb max (R17), dual posts not staying
(R13/R21). All await the next TestFlight build.

### R24 — "Can't scroll through pending requests" (emal)

app/pending-requests.tsx rendered its rows in a plain View — no ScrollView, so
7+ requests ran past the fold and cut off. Now a ScrollView.

### R25 — "Dual posts only keep the back camera when u add ur workout" (Ryan)

Render bug, not a data bug: the inset uploads fine, but a post with attached
workouts renders through PostStack (photo + workout slides), which never drew
`post.insetUri` — only FbMedia did. PostStack's photo slide now shows the same
corner PIP with tap-to-swap. (CarouselMedia can't hit this: dual posts store
media_urls = null, so dual + multi-photo don't co-occur.)

### R26 — "New friend's profile locked until app restart" (emal)

Accepting a request invalidated friend-requests/friends/user-counts but NONE of
the visibility-gated caches: friendship-status (the lock itself), the friend's
posts, streak, tagged, mutuals, feed. The pre-acceptance "private" view stayed
cached (and persisted). useRespondToRequest now invalidates all of them.

### R27 — "Zoom bounces then covers the screen until refresh" (emal)

Two ways the full-screen zoom overlay could strand: (1) the hide only ran in the
release spring's completion callback when `finished === true`, so an interrupted
spring never hid it; (2) the release logic lived in `.onEnd`, which does not fire
when the gesture is CANCELLED (list steals it / navigation mid-pinch), so the
spring never even started. Fixed: `.onFinalize` on both gestures (fires on every
termination), hide-on-completion regardless of `finished` (a new pinch re-shows
in its own onStart), and an unmount cleanup if the owning card is recycled while
zoomed.

### R28 — "Can't react to a tagged post until you view it in the main feed" (emal)

The tag notification lands on /post/[id], which rendered PostCard with no
`onReact` — the live-reaction button was a silent no-op there. Now opens the
ReactionCaptureSheet like the feed. Also passes zoomPreview={false}, which this
screen's own type comment required but the call site never did (the root zoom
overlay is invisible above this screen; in-place zoom takes over).

### R29 — "Can't swipe through tagged posts" (emal)

Tagged grid tiles opened each post's DAY viewer — see one, back out, open the
next. New /tagged-posts/[postId]: all of a user's tagged posts as one vertical
feed (grid order, landing on the tapped tile), full PostCard per row, one
batched query + one batched sign for the details the grid doesn't hold. Both
tagged grids (own profile + user/[username]) route there now.

### R30 — "Repost a tagged post on your story" (Ryan) — NEW FEATURE

IG pattern. `stories.shared_post_id` (cascade — deleting the original retracts
reshares) + `repost_tagged_to_story(post_id)` SECURITY DEFINER RPC, applied
live: requires an actual post_tags row for the caller, photos only, once per
post while a reshare is live, and copies the RAW media path server-side (the
client only ever holds signed URLs). Verified with simulated JWTs: tagged
repost inserts with the raw path + link; untagged caller rejected.

Client: "Add to your story" row in the post ⋯ menu, shown only when the viewer
is tagged (caption tags or photo tags) and the post is a photo; story viewer
shows a "View post" credit chip → /post/[id]. Reshare visibility follows YOUR
story audience; the tap-through respects the original's RLS (a non-friend of
the owner sees "no longer available").

### R31 — Rest day must show on the locked page, with a change-of-mind path (24 Aug)

Logging a rest day left the lock overlay completely unchanged — same "Post to
unlock" pitch, same "Taking a rest day" button — so the tap read as doing
nothing, and there was no way back if you decided to train after all.

LockOverlay now reads today's ledger state (same streak-days cache as the
profile calendar, so the mark/clear invalidation flips it live):
- Rest logged → Moon emblem, "Rest day logged.", copy stating the streak is
  safe AND that the feed still unlocks only with a post (the rest day never
  unlocks — seeing drops still costs a drop).
- The rest button flips to "Cancel rest day" (mark_rest_day(false), which the
  server already supported). The post CTA and workout button stay — that IS the
  changed-my-mind path.

Calendar: today's rest cell (own profile only) is now tappable → confirm →
cancel the rest day. Past rest cells stay read-only history — the server only
allows clearing today, so the UI matches. The rest cells themselves already
rendered distinctly (moon on slate ring, excluded from the month count,
"rest day" a11y label) from the R-round that added the ledger.

### R32 — Discoverable no longer hides anyone from suggestions or search (24 Aug)

Product decision (octav): "any user can be on the suggested list" — the
Discoverable toggle must not affect suggestions or adding as a friend. It had
been hiding 21 of 68 accounts (all toggled off under the old misleading copy).

Applied live + mirrored in migration 20260824020000:
- get_friend_suggestions: `p.discoverable = true` filter REMOVED. Verified:
  75 users − self − 13 friends − 8 pending = 53, and the RPC returns exactly
  53, including all 18 previously-hidden eligible users.
- search_profiles_fuzzy: the non-discoverable-users-are-exact-username-only
  branch REMOVED — everyone scores through the same fuzzy path (verified a
  hidden user is findable by a 4-char display-name prefix under a simulated
  JWT). Blocks still apply everywhere.
- The toggle now governs exactly ONE surface: match_contacts (phone/email
  contact matching), which stays gated — that's the genuinely sensitive one.
  Settings row retitled "Contact matching" with copy that says only that.

### R33 — Deleted post's day says so in the day viewer (24 Aug)

The ledger keeps a gym day when its post is deleted (that IS the streak
protection), so the calendar rightly shows a gold day — but tapping it landed
on "No posts saved for this day", which read as the calendar lying. The day
viewer now checks the ledger when the day has no surviving posts: gym day →
"This day's post was deleted / the gym day still counts"; rest day → "Rest
day / streak frozen, not broken". Non-visible ledger rows (RLS) fall through
to the old generic empty state. Verified against octavio's real Aug 18 row
(kind=gym, post_id=null, zero posts remaining).

### R34 — Friend-search keyboard never dismissed (24 Aug)

"Keyboard doesn't go away after typing in a user to find them." The Add
Friends scroll view uses keyboardShouldPersistTaps="handled" so result taps
went through, but nothing ever dismissed the keyboard. Now dismissed on: Add
(or any relationship button) on a search result, opening a result's profile
(so it's gone when you back-arrow out), switching the Messages/Friends/Add
tabs, and dragging the list (keyboardDismissMode="on-drag"). The keyboard's
own Search key already worked.

### R35 — Shared-component consolidation round 1 (24 Aug)

Audit found ~1,900 duplicated UI lines across ~105 sites. Consolidated the
safe tiers (~700 lines removed), no behavior changes except two bug fixes:

- ui/EmptyState — one icon-in-circle empty/locked/coming-soon state (tones:
  default/gold; center variant). Adopted at: day viewer (deleted-post + rest
  states), settings/coming-soon, community private-lock, profile-section
  videos, user-profile feed-lock + private-lock.
- ui/Stat — replaces 4 stat-block copies (InlineStat + Stat in profile.tsx,
  StatCell + hand-inlined flame stat in user/[username].tsx). sm/lg sizes.
- profile/SocialLinksRow — byte-identical rows in both profile screens; own
  profile also gains the missing accessibilityRole="link".
- profile/PostGridCell — one grid cell for both profiles' posts+tagged grids.
  FIXES: (1) own-profile tagged grid used width:"33.333%" — the exact
  2-column-wrap bug documented in user/[username].tsx; now Math.floor(w/3).
  (2) other-profile cells had no thumbnail-first, no ImageOff fallback for
  missing signed URLs (black tiles), no disk cache — now identical to own.
  Other-profile posts grid also gained the missing loading skeleton.
- hooks/useGymStreak — the verbatim computeGymStreak+instanceof-Map memo from
  both profile screens; they can no longer disagree.
- post/PostPagerScreen + lib/toFeedPost — the FlashList pager scaffold
  (viewability/audio/reaction-capture/skeletons) shared by profile-posts,
  daily/[date], and tagged-posts; SignedPost→FeedMockPost mapping extracted.
- settings/ModeratedAccountsScreen — blocked.tsx/restricted.tsx were 95%
  identical twins; now ~30-line wrappers.
- friends/PickFriendSheet — ForwardSheet/ShareToFriendSheet were 90%
  identical; now thin wrappers.
- ui/MenuRow + ui/ConfirmSheet — ContentMenu's local Row (9 uses) and its two
  verbatim confirm-sheet bodies.
- ui/SettingRow (SettingToggle/SettingRow/SettingNavRow/SettingSectionLabel)
  — byte-identical locals in settings/notifications + settings/privacy.
- Deleted dead files: ui/GlassCard.tsx, components/EmptyState.tsx (0 imports).

Deferred (need design sign-off or FlashList row-height verification):
profile tab-bar unification (3 divergent typographies), ListRow widening
across 8 person-row copies, button/pill unification (~12 sites, real 1-2px
diffs), streak-calendar card reconciliation, community create/edit form
merge, AvatarStack, OptRow adoption for icon-circle nav rows.

### R36 — Workout names never survived leaving the screen (24 Aug, Ryan)

"None of my lifting section names are saving." The custom workout name (the
header pencil) was plain useState in app/workout.tsx while the session itself
lives in the persisted zustand store — the exact feature that lets you leave
mid-workout and resume from the IN PROGRESS card. Leave (or restart the app),
resume, finish → the screen remounts with name "" and the workout saves under
the auto title. Fix: name moved into useWorkoutSession (persisted + hydrated +
reset on start/clear); the screen reads/writes session.name. Edit, repeat, and
routine hydration all still seed it correctly.

### R37 — View + login tracking actually captures now (25 Aug)

post_views / profile_views / story_views tables existed but post_views and
profile_views had 0 rows ever: the only post-view writer (useMarkPostViewed)
had no callers, upserts would error on re-view (no UPDATE policy), and
profile_views had no write path at all.

DB (migration 20260825010000, applied + verified via simulated JWTs):
- post_views: + last_viewed_at, view_count; UPDATE-self policy;
  record_post_view(p_post_id) RPC — insert on first view, bump recency+count
  on re-view, SKIPS the viewer's own posts. Verified: 2 calls → 1 row count 2;
  own-post call → 0 rows.
- profile_views: record_profile_view(p_profile_id) RPC — self excluded,
  1-hour dedupe per viewer→profile, blocked-user RLS rejections swallowed.
  Verified: 2 rapid calls → 1 row. Indexes on (profile_id, viewed_at) and
  (viewer_id, viewed_at).
- user_activity: backend-only mirror of auth.users.last_sign_in_at (RLS on,
  NO policies — service-role reads only), trigger on_auth_user_login keeps it
  fresh, 77 users backfilled. Verified invisible to authenticated role.

Client (capture only, nothing displayed — ships next build):
- useRecordPostViews (useFeed.ts): fire-and-forget, once per post per mount;
  wired into feed viewability (skipped while feed is locked/blurred) and
  PostPagerScreen (profile pager + day viewer + tagged pager).
- useRecordProfileView (useProfile.ts): wired into app/user/[username].tsx.
- types/database.ts: both RPC signatures added (hand-patched as always).

Note: story_views emptiness is expected — stories delete on expiry and the FK
cascade removes their view rows with them.

### R38 - Analytics v2: sessions, 40+ events, activity ledger, rollups (25 Aug)

Goal: enough signal to build an internal usage-metrics tool. Full reference
in docs/ANALYTICS.md.

DB (migration 20260825020000, applied + verified):
- analytics_events + session_id / app_version / platform / os_version.
- user_activity gains first/last_active_at, active_days, sessions_count,
  last_app_version/platform; new user_activity_days (user x day) ledger.
  touch_user_activity() RPC (SECURITY DEFINER, tables have no client
  policies) called on every app foreground for EVERY user - consent-free
  DAU/retention for the whole base (verified: 2 touches -> sessions 2,
  active_days 1, zero rows visible to clients).
- New internal schema `analytics` (not API-exposed, revoked from anon +
  authenticated): views sessions / events_daily / screens_daily /
  weekly_retention / daily_post_funnel / user_overview; durable tables
  daily_events / daily_screens / daily_summary filled by
  analytics.rollup_day(date) - cron 04:00 UTC, before the 04:17 90-day purge.
  Backfilled 20 days from existing events.

Client:
- lib/analytics.ts rewritten: session lifecycle (30-min gap rule, app_open
  cold flag, session_end), screen dwell time, batching (4s / 20 events,
  flush on background + sign-out), context columns, client_error sink for
  logger.warn/error, useActivityHeartbeat. Allowlist-per-event kept.
- ~25 instrumentation sites: friends (search, request sent/responded,
  suggestion dismissed), messages (sent, reacted, forwarded), post reactions,
  rest day, routines, taunts, delete/report, stories (viewed, reposted),
  contacts sync, push permission, notification opened, auth (profile
  created, onboarding stage, sign out), feed refresh, lock CTAs, camera
  (geofence blocked, music selected, draft saved, enriched publish), workouts
  (started w/ source, completed w/ metrics, discarded), privacy settings.
- Consent boundary respected: no device model, no text, no ids in props.

Open product decision: opt-in rate is 32% (24/75). The event stream only
sees consented users; the activity ledger sees everyone.

### R39 - Analytics default-on, regional consent, policy update + notices (25 Aug)

Legal model: first-party usage analytics is on by default with an opt-out
(US: notice, not consent); EEA/UK/CH users get an opt-in prompt; third-party
sharing stays a separate future opt-in. See docs/ANALYTICS.md.

DB (migrations 20260825030000 + 20260825040000, applied):
- analytics_events event-name CHECK was still pinned to the original 14
  names - every new event would have been rejected. Replaced with a shape check.
- analytics_preferences.basis (consent|default|declined). 24 consented rows
  kept as consent; 51 "Not now" rows flipped to enabled/default; 2 never-
  prompted backfilled; column default now true; trigger creates a default-on
  row with each new profile.
- notification_type enum + 'system_notice' (actor-less notices carrying
  title/body/route in payload).

Client (ships next build): AnalyticsConsentHost rewritten around
expo-localization region detection (prompt only in regulated regions,
silent default-on row elsewhere; a default row never counts as consent in a
regulated region); settings copy retitled "Usage analytics"; toggle writes
basis + ANALYTICS_CONSENT_VERSION; system_notice routing (allowlisted
/settings/privacy, /settings/legal/*), inbox rendering ("Spotted" as actor),
push payload formatting; LEGAL_VERSION/date -> 2026-08-25; in-app policy copy
matches the public one.

Edge (deployed): send-push formats system_notice, bypasses category toggles
(push on/off + quiet hours still apply); export-data now includes analytics
events/preference and activity rows (access-right completeness).

Public policy: octagonn/spottedtermsandprivacy PRIVACY_POLICY.md commit
9b6f984 - usage analytics section, activity & view records, never-shared
promise, retention, summary of changes.

Notices: 77 system_notice rows (51 flip-specific, 26 policy-update). Push:
25 ticketed, 52 no registered device (seen in the in-app inbox instead).

### R40 - System notices render properly + one-time policy sheet (25 Aug)

The 1.1.0 build shows a system_notice as "Someone sent you an update" (it
predates the type). 1.2.0: dedicated inbox row (shield icon, payload title
bold, body beneath, chevron; tap opens the payload route, e.g. the privacy
policy). Because inbox notices expire after 7 days and the build may land
later, components/PolicyUpdateNotice.tsx shows a one-time "Privacy Policy
updated" sheet on first launch (keyed by LEGAL_VERSION + user id) to every
account created before the effective date, with "Read the policy" / "Got it".

### R41 - Push copy rewrite: hooks in the title, rotation, social proof (25 Aug)

Feedback: notifications were abundant but not "grabby" (title "Spotted",
body "8 day streak. Don't break it today."; "Haven't seen you at the gym
today." sent 365x). Rule now: the TITLE carries the hook (name / number /
consequence), the body adds urgency or social proof, repeat types rotate.

- daily_nudge_sweep (DB, live): emits title + text. Streak: "N-day streak on
  the line" / "Post your SPOTTED before midnight or it resets to zero" /
  "<k> friends already posted today. Your move." (real friend count). No
  streak: "<k> friends posted today. You didn't." / "Your feed is locked" /
  "Nobody's seen you today". Broke yesterday: "Your streak is dead. Day 1
  starts now." Variant is stable per user per day, rotates daily.
- notify_gym_arrival (DB, live): arrival_buzz rotates "You're in. Clock's
  running." / "Checked in. Now prove it." / "You showed up." + post-before-
  you-leave bodies.
- send-push (deployed): every type rewritten (e.g. "<name> is at <gym> right
  now / Where are you?", "<name>'s streak is dead / 14 days, gone. Taunt them
  back into the gym.", "<name> took the bait", "N-day streak (fire)"). Seeded
  rotation via notification id. Also FIXED: post_comment had no formatter at
  all (type union + switch + preference gate + route added).
- lib/pushPayload.ts mirrors the copy for in-app banners; tests updated.

### R42 - Push copy tone pass: friendly, not harsh; 5-6 variants (26 Aug)

Feedback on R41: "grabby but not too harsh, and lots of variants." Removed
"dead / kills / you didn't / are you even trying". Daily nudge now rotates
six titles x six bodies per state (streak / no streak / broke yesterday),
stable per user per day, with the real friends-posted-today count woven in
("3 friends already posted today. Join them."). Arrival check-in rotates six.
Edge copy: 3-5 variants for friend requests, accepts, likes, milestones,
friend arrivals, taunt answers; streak_break_friend is now "<name>'s streak
ended / 14 days. Send a taunt to get them back in." DB functions live;
send-push redeployed; client mirror + test updated. Mirror migration
20260826010000.

### R43 - Mutual adds no longer duplicate; feed opens at the top (26 Aug, emal)

1. "If you add someone they can also add you / they show up twice." The
   friendships PK is directional (user_id, friend_id), so A->B and B->A both
   existed (ethan<->maxdifilippo had two accepted rows). Migration
   20260826020000: deleted the newer duplicate; BEFORE INSERT trigger
   friendships_collapse_reverse turns an "add" into an ACCEPT when the other
   person already requested you (and silently no-ops when already friends);
   unique index on (least, greatest) guarantees one row per pair. Verified
   under a simulated JWT: reverse add -> 1 row, status accepted. Client:
   useSendFriendRequest now also invalidates friend-requests /
   friendship-status / friendship-states / user-counts so the button flips to
   "Friends" rather than "Requested".
2. "Feed loads from the last post I saw and I have to scroll up." FlashList
   v2's maintainVisibleContentPosition (on by default) anchored the viewport
   when the refetch prepended newer posts above the cached ones. Now
   autoscrollToTopThreshold: 300 - anyone within 300px of the top (i.e. on
   app open) follows the new posts to the top; mid-scroll readers keep their
   place. Ships next build.

### R44 - HOTFIX: sign-up broken by the last-login trigger (26 Aug)

"Database error granting user" on email OTP verification (and Apple
sign-in). Cause: R37's on_auth_user_login trigger inserted into
user_activity (FK -> profiles) when auth stamped last_sign_in_at - which for
a NEW user happens before the profile exists - so the FK failed and took the
whole auth transaction down. Introduced 25 Aug ~evening; 3 sign-ups stranded
(auth user created, no profile) - they can simply request a new code and
verify. Fix (migration 20260826030000, applied): the trigger skips users
without a profile and is wrapped so it can NEVER fail auth; the profile-insert
trigger backfills last_login_at once the profile exists. Verified by replaying
the auth update against an orphan user in a rolled-back transaction.
Lesson recorded: no trigger on auth.users may reference public tables
without an exception guard.

### R45 - Communities hub v1 + geofence revert (26 Aug)

Geofence: reverted R-round 40 m/100 m to the originals (presence 75 m live via
migration 20260826040000; camera gate 0.2 mi, next build).

Communities hub (spec v1, design approved as the "inbox, not a switcher" mock):
- components/communities/CommunitiesHub.tsx replaces the "coming soon"
  placeholder in the Map tab's Communities segment; the parked
  __communities-wip branch and its helpers were removed from map.tsx.
  Hero = the gym you're checked in at (presence store), else your home gym's
  community; carries member/tenure chips, "here now" (only when >0), the
  latest chat line, today's check-in count, Open chat (NEW pill on unread) +
  Feed. Other memberships as rows sorted unread > recency > name with quiet
  copy. Nearby gym communities you haven't joined render as locked rows
  ("Board & feed locked - check in to join") -> LockedCommunitySheet (name,
  member count, thumbnail, lock copy; never data). Non-gym public crews keep
  Join; "New crew" + invite-code entry preserved.
- Join prompt (components/communities/JoinGymCommunityPrompt.tsx, mounted in
  AppServices): after a check-in at a gym whose community EXISTS (never
  auto-created) and you're not a member: "N people you've checked in with are
  in the X group" (friends in members) or "N members check in at X. Join?".
  Never auto-adds; dismissed = not asked again for 7 days per gym (AsyncStorage).
- Community screen: tabs Chat / Board / Feed / Members (Chat default; old
  ?tab=Posts deep links map to Feed). Members tab inline with tenure chips +
  one-tap Leave (moved off the header row per spec). Mute toggle in header
  (community_members.muted). Tenure chips next to sender names in chat.
- lib/communityTenure.ts: Day 1 (same UTC day as launch) / Founding (first 30
  days). 4 tests.
- DB (migration 20260826050000): community_members.muted; RPC
  community_presence_now(p_community_id) - SECURITY DEFINER, refuses
  non-members (locked:true), lists only community MEMBERS with a visible,
  non-quiet active check-in. Verified with simulated JWTs.

Honest gaps (not faked in UI): the Board itself is still a placeholder; the
mute flag is stored but community chat pushes don't exist yet, so mute
currently affects nudges/invites once send-push reads it (TODO); "here now"
shows community members only.

### R46 - Communities gaps closed: Board, chat pushes + mute, Gyms label (26 Aug)

1. Board (migration 20260826070000): community_board(p_community_id) -
   SECURITY DEFINER, refuses non-members ({locked:true}); per member computes
   (a) streak = consecutive local days (member's own timezone) with >=1
   check-in at THIS gym, anchored to today/yesterday (gaps-and-islands), and
   (b) distinct check-in days this calendar month. Verified: member -> 4
   ranked rows (Ethan 3-day streak / 8 days this month); non-member -> locked.
   Client: useCommunityBoard + rankBoard (ties share a rank); Board tab =
   Streak / This month segmented list, gold rank for top 3, your row
   highlighted and pinned below a gap if outside the top 25; hub hero's
   second signal now shows your real rank ("You're #4 - 3-day streak") and
   the CTA is Board.
2. Group-chat pushes (enum 'community_message' 20260826060000 + trigger):
   AFTER INSERT on community_messages fans out via dispatch_notification to
   members except the sender, skipping muted members, deduped to one per
   member per community per 10-minute window. send-push: DM preference +
   quiet hours apply, "messages" channel, 24h TTL, deep-link
   /community/<id>?tab=Chat; plus a mute check (community_members.muted) that
   also suppresses community_nudge / community_invite. Chat notifications are
   excluded from the inbox list + badge (they belong to the chat). Verified by
   a rolled-back insert: 3 notified = expected, sender excluded. send-push
   redeployed.
3. Tab label "Gym map" -> "Gyms".

## R38 — Policy notice loses "Got it" after reading; feed refresh replays lock animation (2026-08-26)

- `components/PolicyUpdateNotice.tsx`: "Read the policy" used to call `dismiss()` (marks seen + hides) before navigating, so the back arrow landed on nothing. Now it hides without marking seen, watches `usePathname()`, and re-shows the sheet once the user leaves `/settings/legal/privacy`. Only "Got it" (or the hardware back) persists the seen flag.
- `app/(tabs)/feed.tsx`: `RefreshControl refreshing` was bound to `feed.isRefetching`, so the 60s background refetch and every focus refetch popped the pull-to-refresh spinner and shifted the list ("the feed refreshes on its own"). Spinner is now driven by a local `pulling` flag set only by a manual pull.
- `components/post/LockOverlay.tsx`: `FadeInDown` entrance now plays once per local day (module-level `enteredForDay`), so any remount of the overlay during the day no longer replays the slide-in. Pulse loop unchanged.
- Verified: tsc clean, eslint clean, vitest 160/160.

## R39 — Community "Invite friends" sheet: not scrollable, no search, re-pops after close (2026-08-26)

- `app/community/[id]/index.tsx` `InviteFriendsSheet`: rows were mapped into a plain `View` with `maxHeight: 320` (clipped, no scroll). Now a `SearchBar` (name/username filter, "No friends match that name." on miss) over a fixed-height `ScrollView` (`keyboardShouldPersistTaps="handled"`, `nestedScrollEnabled`). Invite/Invited ✓ row buttons unchanged.
- `components/ui/Sheet.tsx`: `onDismiss` now also `setContent(null)`. Dismissed content stayed mounted, so any later height change (query settling, row state) made the dynamic-sizing modal re-measure and present itself again. Clearing after the dismiss animation completes avoids the mid-animation bounce/crash the provider comment warns about. Applies to every sheet in the app.
- Verified: tsc clean, eslint clean, vitest 160/160.

## R40 — Community roles & permissions, gym chain logos, preview-sheet re-pop (2026-08-26)

**Roles (Discord-style)** — migrations `20260826080000_community_roles.sql`, `20260826100000_community_roles_view_posts.sql` (applied).
- `community_roles` (per community: name ≤32, hex `color`, `position`, `is_default`, `is_admin`, `can_view_chat`, `can_send_messages`, `can_view_posts`, `can_post`, `can_invite`, `can_manage_members`, `can_manage_roles`); `community_members.role_id` (FK, on delete set null → falls back to the default role). Every community seeded with Admin (gold, all perms) + Member (default); creator auto-assigned Admin on join; backfilled from the old `role` text.
- `community_permissions(community, user) → jsonb` (owner always everything; admin roles everything; else the role flags) and `community_can(community, user, perm)`. RLS now consults them: chat select `view_chat`, chat insert `send_messages`, `post_communities` insert `post`, invites `invite`, join requests `manage_members`, community update `admin`, `posts_select_visible` community branch `view_posts`. `respond_join_request` opened to `manage_members`.
- RPCs `set_community_member_role` (owner locked; no self-change unless owner; granting/revoking admin needs admin) and `remove_community_member`. Guard triggers: role columns immutable via plain UPDATE (bypass flag only set inside the RPC); default role undeletable; last admin role undeletable/undemotable; admin roles editable only by admins; single default per community.
- Verified via simulated JWTs (rolled back): member with chat locked → message INSERT rejected; self-promotion via UPDATE and RPC both blocked; member cannot rename roles (0 rows); owner can promote/rename/create; deleting the default role → `default_role_locked`.
- Client: `useCommunity` returns `perms` (+ `isAdmin`/`canManage` derived); `useCommunityRoles`, `useCreate/Update/DeleteCommunityRole`, `useSetMemberRole`, `useRemoveCommunityMember`, `roleErrorMessage`. `app/community/[id]/roles.tsx` (new): list + editor (name, HSV **color wheel** `components/ui/ColorWheel.tsx`, permission toggles incl. View posts, default toggle, delete). `members.tsx`: role chips (`components/communities/RoleChip.tsx`), managers get a ⋯ sheet to assign a role / remove. `settings.tsx`: Roles + Members rows for managers; join requests gated by `manage_members`. `index.tsx`: Chat tab hidden without `view_chat`, read-only strip without `send_messages`, Feed tab hidden without `view_posts`, camera button needs `post`, Invite button needs `invite`.

**Gym chain logos** — migration `20260826090000_gym_chains_and_manager_join_requests.sql` (applied): `gyms.chain` + `gym_chain_for_name()` + trigger; ~7.9k of 25k gyms tagged across 35 chains. Client `lib/gymChains.ts` (same regexes, `gymLogo()`), 28 bundled 256px PNGs in `assets/gym-logos/` — ONE per chain. Shown by `components/GymLogo.tsx` on the map pin sheet, map cluster rows, gym page, the Communities hub tile and community header for gym communities without a custom photo. No art found for crossfit, ufc, esporta, edge, genesis, onelife, xsport (they fall back to the current icon).

**Preview sheet re-pop** — `components/ui/Sheet.tsx`: `wantOpen` intent flag + `onChange` guard dismisses the modal if it ever presents itself outside open()/close() (the tiny empty second sheet after "Got it" on a locked community preview).
- Verified: tsc clean, eslint clean, vitest green.

## R41 — Sheet ghost flash, hub search under keyboard, Reanimated warning spam, logo fit (2026-08-26)

- `components/ui/Sheet.tsx`: the `BottomSheetModal` is now **mounted only while a sheet is open** (`content ? <BottomSheetModal/> : null`; `present()` runs from an effect once the fresh ref exists). A dismissed-but-mounted dynamic-sizing modal re-presented itself whenever its content re-measured — with content kept it re-opened fully (invite sheet), with content cleared it flashed as an empty mini sheet (map pin sheet, locked community preview). Unmounting removes the mechanism entirely; the `wantOpen` / `onChange` guard stays as a backstop.
- `components/communities/CommunitiesHub.tsx`: "Search public communities" reused the existing `SearchBar` (now with an `onFocus` prop). On focus the ScrollView scrolls the field to the top and pads the bottom by keyboard height + 240, so results render between the field and the keyboard. `automaticallyAdjustKeyboardInsets` on iOS, `keyboardDismissMode="on-drag"`.
- `components/ui/Stat.tsx`: the Reanimated babel plugin flags **any** `x.value` read inside a JSX `style` literal (it injects a runtime check for objects with a `value` key). `sz.value` (a plain size preset) fired it once per stat render → ~20 warnings per bundle. Renamed to `sz.number`. The remaining Expo Go warnings (expo-notifications remote push, media-library access) are Expo Go limitations, not app bugs; they don't appear in dev/TestFlight builds.
- Logo fit: `GymLogo` / hub `Tile` split logos into full-bleed brand squares (EōS, UFC, Esporta, Onelife, Edge, Genesis — sourced from the brands' page pictures; rendered `cover`) vs transparent wordmarks (white disc, 68%). EōS replaced (was the favicon "ō"); CrossFit added from Wikimedia. 34/35 chains covered (XSport missing). Gym communities without art show a dumbbell instead of initials.
- Campus gyms: `gyms.institution` (slug) + `gyms_in_bounds` now returns `chain`/`institution`; `lib/institutionLogos.ts` (generated) holds one bundled logo per college; `gymLogo()` prefers institution over chain. Backfill via `scratchpad/institutions.py` (Nominatim/Overpass reverse-geocode → Wikipedia seal/logo).
- Verified: tsc clean, eslint clean, vitest 163/163.
- Campus backfill applied: 121 gyms tagged across 113 institutions; 86 institution logos bundled (`assets/institution-logos/`, 192px quantized, 1.1 MB total). Misses (27, e.g. Michigan, Florida, Toledo) have no seal/logo-named file on their Wikipedia page; add a PNG + line in `lib/institutionLogos.ts` to extend.

## R42 — Unadd/unfriend, workout scroll freeze, @mentions in comments (2026-08-27)

- **Unadding didn't work**: tapping "Added" flipped the relationship store and toasted "Request withdrawn" but never called the backend, so the pending row came back on reload. `app/user/[username].tsx` and `app/(tabs)/friends.tsx` now call `useCancelFriendRequest` on `requested → none`. Real unfriending never existed (the "✓ Friends" pill is non-interactive by spec): added `useRemoveFriend` (deletes the accepted row in either direction, invalidates every friendship-gated cache) and a **Remove friend** entry (confirm sheet) in the profile ⋯ menu (`ContentMenu.onRemoveFriend`).
- **"Log a workout with it" → scrolling stuck**: `DraggableList` re-enabled the parent ScrollView only in the pan gesture's `onEnd`. A cancelled lift (touch stolen by a scroll, navigation, system interruption) never fired it, leaving `scrollEnabled={false}` until the user swiped out. Added `onFinalize` → always release; on a cancel the card snaps home.
- **@mentions in comments** (Ryan M request): `CommentsSheet` shows friend suggestions while the draft ends in `@…`; tapping completes the handle. Rendering already linked handles via `splitMentions`. Server: `notification_type` gains `mention`; trigger `post_comments_notify_mentions` notifies each mentioned user (deduped, not self/post owner, respects blocks and post visibility) with push. Client maps `mention` in inbox copy, routing (→ post) and push payload.
- Verified: tsc clean, eslint clean, vitest 163/163.

## R43 — Private posts on a public account (2026-08-27)

- `profiles.posts_private` (migration `20260827030000_profiles_posts_private.sql`, applied). New `are_posts_public(uid)` = public account AND NOT posts_private AND active; it replaces `is_account_public` inside `can_view_content`, `can_read_post`, `posts_select_visible` and the mention trigger — so posts, comments/reactions/views/replays on them, workouts, streaks, gym days and tags all go friends-only while the profile card stays findable/visible. `is_account_public` (search/discovery) is unchanged.
- Settings → Privacy: **Private posts** toggle under Private account (shown on/disabled when the whole account is private).
- Other profile: public + posts_private renders the locked state titled "Posts are friends-only" with the Add button; identity card still shows.
- Verified: tsc clean, eslint clean, vitest 163/163.

## R44 — DM keyboard dismissal + composer backdrop (2026-08-27)

- `app/chat/[id].tsx`: the composer had an absolute `rgba(0,0,0,0.92)` backdrop reaching 28px above it — the "weird black translucent box" over the keyboard. Removed; composer is plain `colors.black`.
- Tapping empty thread space now dismisses the keyboard (RN Pressable wrapping the message list; bubbles keep their presses); `keyboardDismissMode="interactive"` so dragging the thread down tucks it away too.
- **DM crash** "cannot add `presence` callbacks for realtime:chat:<id> after `subscribe()`" (`hooks/queries/useChatPresence.ts`): `supabase.channel(name)` returns the existing channel for a topic and the previous mount's `removeChannel()` is async, so a fast re-mount (tap out/in of a thread, RN effect reconnect) reused the already-subscribed channel and `.on("presence")` threw at render. The effect now removes any channel on that topic first, then creates a fresh one; cleanup is cancellation-safe. This was the "clicking a notification crashes" report too (notification → chat thread).

## R45 — No DM push while the thread is open (2026-08-27)

- Migration `20260827040000_dm_push_suppress_active_thread.sql` (applied): `profiles.active_conversation_id/_at`, RPC `set_active_conversation(uuid|null)`, `is_viewing_conversation(user, conv)` (75s window). `notify_dm()` skips `dispatch_notification` for any recipient currently viewing that thread (1:1 and group), so no notification row and no push — the message already arrived over realtime.
- Client: `useActiveConversation(conversationId)` in `hooks/queries/useChatPresence.ts` pings the RPC on focus + every 30s while the app is active, clears on blur/background/unmount, and sets `useBannerStore.activeConversationId`; `useInAppBanners` drops the top banner for that thread.
- Verified (rolled back): message while viewing → 0 dm notifications; after leaving → 1.
- tsc clean, eslint clean, vitest 163/163.

## R46 — No auto-DM on friend accept; "Tap to start conversation" rows removed (2026-08-27)

- DB (`20260827050000_drop_conversation_on_accept.sql`, applied): dropped trigger `friendships_ensure_conversation` + `ensure_conversation_on_accept()`. Threads are created on demand when a chat is opened (`useConversation` insert-or-lookup), unchanged.
- `components/friends/useInboxThreads.ts`: 1:1 conversations with no messages are skipped entirely (previously surfaced as a placeholder thread).
- `app/(tabs)/friends.tsx`: removed the placeholder rows for friends without a thread and the `useStartedThreads` unread-styling hook (file deleted). Empty state: "No messages yet. Open a friend's profile and tap Message."
- Existing empty conversations created by the old trigger stay in the DB, hidden; they get reused when someone opens that chat.
- tsc clean, eslint clean, vitest 163/163.

## R47 — Inbox: unseen dot on lock screen, blocked-actor names, merged rows, DM read-on-open (2026-08-27)

- `components/post/LockOverlay.tsx`: red dot on the bell when `useActivityUnreadCount() > 0` (the feed header badge is hidden behind the overlay while locked).
- Blocked actors: `profiles` RLS hides anyone in a block either way, so old notifications from them rendered "Someone sent you a message". `useNotifications` now resolves missing actors via the new security-definer RPC `profile_lite(uuid[])` (id/username/display_name/avatar only; migration `20260827060000_profile_lite_rpc.sql`, applied; verified: direct select 0 rows, RPC 1 row).
- `app/inbox.tsx`: rows from the same actor + type inside a day bucket collapse into one (dm, reactions, comments, mentions, tags, taunts, waves, gym arrivals, second workouts): "X sent you 4 messages", "X reacted to 3 of your posts"… Merged row = newest id/route/thumb, unread if any member is.
- Opening a DM thread marks its `dm` notifications read (`useMarkConversationNotificationsRead`, filtered on `payload->>conversation_id`; optimistic + invalidate) — inbox badge drops without visiting the inbox.
- tsc clean, eslint clean, vitest 163/163.

## R48 — Communities hub search: field vanished on typing, gyms not found (2026-08-27)

- Vanish: typing re-keyed `useDiscoverCommunities`, its data emptied during the refetch, the "Nearby · not joined" section above the field collapsed and the scroll position jumped the field off-screen. Fixes: `placeholderData: previous` on the discover query, and a **search mode** in `CommunitiesHub` — while the query is non-empty every section above "More communities" is hidden (same tree slot, so the TextInput keeps focus) and the field stays at the top.
- Gyms: results only included non-gym communities, and most gyms have no community row at all. Search now also runs `useGymSearch` (`search_gyms` RPC, no coords) and lists up to 8 gym hits as locked rows (chain/institution logo tile, address, lock) opening the existing locked preview sheet; gym communities that do exist are included too. Empty copy: "No gyms or communities match that name."
- tsc clean, eslint clean, vitest 163/163.

## R49 — Communities tab, My Workouts on profile, Trophies v2 (2026-08-28)

**Navigation**
- Dumbbell tab → **Communities** tab (`Users` icon, label "Communities"). `app/(tabs)/map.tsx` segments are now [Communities | Map], default Communities.
- "My Workouts" (history / records / in-progress card) moved to `app/my-workouts.tsx` (stack screen, PanelHeader) and opens from a large gold **My Workouts** button on the profile, directly above the streak calendar.

**Network error** — `[TypeError: Network request failed]` with only whatwg-fetch in the stack is supabase-js auth auto-refresh losing connectivity for a moment (auto-retried). `lib/supabase.ts` console filter downgrades that exact case to a warning.

**Trophies v2 (spec: Spotted Trophies v1)** — migrations `20260828010000_trophy_definitions_v1.sql`, `20260828020000_trophy_engine_v3.sql` (applied).
- `trophy_definitions` (key/category/tier/rule_type/rule_params/family/sort/repeatable/active): 4-tier Streak (7/30/100/365) and Check-ins (25/100/250/500) ladders, Comeback (repeatable per run) + Phoenix, Top of the Gym (monthly, ≥8 verified check-ins, repeatable) + 3-Peat, milestones (First Check-in, Day 1, First Crew, Referral), novelty (Early Bird, Night Owl, Rush Hour, Lunch Break, 5 AM Club, Weekend Warrior, Never Miss Monday, Perfect Week, New Year, Summer Shred, Holiday Hustle, Birthday Beast, Leap Day, Anniversary), social (Regular, Gym Hopper, Thick Skin, Welcome Wagon, Squad Goals), PR ladders from `trophy_rules` with named clubs (2/3/4-Plate, Iron Curtain, 600 Club), cardio ladder seeded inactive. Adding a trophy = one INSERT.
- `user_trophies`: `definition_id`, `instance_key` (PK now user/trophy/instance), `context` (gym, month, run), `celebrated_at`; RLS select for friends/public-content viewers. Old keys remapped (streaks:7→streak_bronze, day-one→day_one, …).
- SQL engine `evaluate_user_trophies` (threshold / calendar / event rules over gym_days+posts in the user's timezone, lifts, memberships, taunts); triggers on gym_days, user_lifts, community_members; monthly `award_top_of_gym` cron; daily `refresh_trophy_rarity` → `trophy_rarity_stats` ("X% of Spotted members"). Backfill ran for all active users (107 backfill notifications suppressed/read).
- Earn side effects (trigger): `trophy_unlocked` notification + push for every tier; **Diamond** posts a `kind='system'` message into the user's gym community chats ("💎 … just hit Diamond — … · top X% of Spotted.").
- Client: `lib/trophies.ts` is now a registry filled from the server (`useTrophyCatalog`); `useTrophies` reads earned rows, `trophy_progress` RPC and rarity stats — no client-side derivation (deleted `trophyEngine/trophyStats/trophyStorage/useTrophyRarity`). `TrophyEarnHost` (root) listens to `user_trophies` inserts in realtime and drains un-celebrated rows on launch → full-screen unlock modal every tier, every time (workout/camera local modals removed). Medal treatment (`lib/trophyMedal.ts`): bronze/silver/gold/diamond colors on cards, ladder rungs, unlock modal; Diamond gets an animated glint. Progress bars read "23/30 days to 30-Day Streak". Inbox: "You unlocked X 🏆". Community chat renders system messages centered.
- Tests: `tests/trophyCatalog.test.ts` (catalog build, achievements/progress mapping). tsc clean, eslint clean, vitest 137/137.
- Not done / follow-ups: profile case still shows pinned featured trophies (spec wants 3–4 most recent + count); referral/welcome-wagon/squad-goals metrics return 0 (no data source yet); cardio PR thresholds inactive until timed-run data exists.

## R50 — All images on Cloudflare R2; Supabase Storage emptied (2026-08-28)

- **Client**: every upload goes to R2 via `uploadMediaObject` (`lib/r2.ts`; the Supabase fallback in `uploadPostObject` is gone — a failed upload throws): onboarding photo, edit-profile avatar (`<user>/avatar-<ts>.jpg`), community photos, chat media, reaction selfies, posts/thumbs/insets/stories. DB stores `r2:<key>`. Display: `CachedImage` (and therefore `Avatar`) resolves `r2:` sources through `lib/media.ts` (`useResolvedUri` → `signedPostUrl`, 6h cache, de-duplicated in-flight); `signedMessageUrl` and reaction selfies sign via the same path; `publicAvatarUrl` is a pass-through for legacy absolute URLs. Moderation deletes use `removePostObjects` (R2).
- **Data migration** (edge function `r2-migrate-all`, authorized by a one-time `ops_tokens` row): copied 107 objects (avatars 52, posts 7, messages 4, reactions 44) to R2 under the same keys with size verification, 0 failures; flipped every reference (profiles 36, communities 1, posts 4, messages 4, post_reactions 32; messages needed the `messages_update_guard` trigger paused); verified 0 Supabase URLs / bare keys remain; purged all four buckets (only objects confirmed present in R2 were deleted) → 0 objects left in Supabase Storage. Token retired.
- **Avatar blur**: `avatar-process` v7 reads the avatar from R2, writes `<user>/blurred-<ts>.jpg` to R2, sets `avatar_blurred_url`. Trigger moved from `storage.objects` to `profiles` (`profiles_avatar_process_r2`, migration `20260828030000_avatars_on_r2.sql`); backfill regenerated all 36 blurred avatars (37×HTTP 200).
- tsc clean, eslint clean, vitest 137/137. Client changes ship with the next build; until then the 1.1.0 TestFlight build (Supabase-URL avatars) will show missing avatars for users who re-upload — the dev build resolves `r2:` correctly.
