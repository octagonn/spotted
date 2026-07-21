# SPOTTED Redesign — UI ↔ Function Map

Complete interaction inventory of `design/redesign.html`. Every button, pressable, gesture, and input in the mockup, per screen.

**Status legend**
- **existing** — current app already has this wired (route / hook in `hooks/queries/*`, `lib/*`)
- **new** — needs new app + (usually) backend work
- **mock-only** — prototype demo behavior; discard or replace with real implementation
- Combined statuses like *existing (partial)* mean the plumbing exists but the redesign behavior differs.

### UI implementation status (2026-07-14)

The per-control `Status` column below tracks backend capability. This table separately tracks the redesign UI pass so a `new` backend status is not mistaken for missing UI.

| Surface | UI status | Backend handoff |
|---|---|---|
| Global primitives + bottom navigation | **complete** | Toast, flash, sheets, posted-today persistence, tab presentation, and posted dot are wired. Server-derived daily state remains deferred. |
| Home / Feed | **complete** | Existing Supabase feed rows render above typed fixtures. Public ranking, spots, selfie upload, comments, and video persistence remain deferred or local-only. |
| Friends + conversations | **complete** | Real 1:1 inbox/read/send hooks are retained. Group conversations, request withdrawal, follows, nearby/contact discovery, and fixture interactions remain session-local pending backend work. |
| Camera daily + max-lift | **complete** | Expo Camera still capture works when permission is granted. Video recording, media upload, post/tag/music/community writes, and server daily gating are deliberately deferred; publish currently updates local UI state. |
| Communities + Map | **complete** | Native uses dark `react-native-maps`; web has a graceful interactive fallback. Community chat, membership, explicit check-ins, waves, challenges, and rankings are local typed fixtures pending backend work. |
| Own Profile + proof routes | **complete** | Real profile identity is used when available. Trophies, achievements, verified lifts/ranks, following, and historical daily archive are fixtures pending backend schemas/queries. |
| Other-user Profile | **complete** | Real profile/posts/friend-request hooks are retained. Mutuals and follow/cancel transitions remain fixture/session state pending backend work and RLS verification. |

Current-app reference points: routes `app/(tabs)/{feed,map,camera,friends,profile}`, `app/{chat,gym,post,user}/[id]`, `app/settings/*`, `app/paywall.tsx`, `app/streak.tsx`; hooks `useFeed`, `useFriends/useFriendSuggestions/useIncomingRequests/useSendFriendRequest/useRespondToRequest`, `useConversation/useMessages/useSendMessage/useMessagesRealtime/useMarkConversationRead`, `useMyReactions/useToggleLike/useToggleSaved/useReplayPost`, `usePostViewers`, `useMyProfile/useProfileByUsername/useUserPosts/useFriendshipStatus/useUserStreak`, `useGymPresence`, `useStreak`, `useSubscription/usePurchaseFlow`; libs `feedRanking`, `friendship`, `geofence`, `camera(useSpottedCamera front|back)`, `location`, `notifications`.

---

## 1. Bottom navigation (global)

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Home tab (house icon) | nav slot 1 | `navTo('home')` — swaps active screen, clears panel stack; re-tap active clears panels | expo-router tab → `/(tabs)/feed` (rename/reorder; pop-to-root on re-tap) | existing (reorder new) |
| Friends tab (people icon) | nav slot 2 | `navTo('friends')` | `/(tabs)/friends` | existing |
| **Camera center button** (64px raised circle) | nav slot 3 (center) | `openCamera()` — slides camera layer up; mode auto = daily/lift by `hasPostedToday()`; gets white "posted" dot after publishing | `/(tabs)/camera` presented as modal-style overlay; posted-dot from today's-post query | existing (presentation + posted-dot new) |
| Map tab (map icon) | nav slot 4 | `navTo('map')` | `/(tabs)/map` | existing |
| Profile tab (person icon) | nav slot 5 | `navTo('profile')` | `/(tabs)/profile` | existing |

Removed vs current app: glass tab bar, `explore` tab, collapsing header. The redesign nav is a gradient-fade bar with center camera.

---

## 2. Home / Feed

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| `Friends` / `Public` segment | below live strip | `setFeedTab('friends'|'public')` — swaps post source (`FRIEND_POSTS` vs `PUBLIC_POSTS` w/ ctx chips) | feed query param: friends feed vs public/discovery feed (proximity + mutuals + traction ranking à la `lib/feedRanking`) | new (friends feed existing; public feed + ctx signals new) |
| Live-strip item (live friend) | horizontal strip under header | `openSpotSheet(uid)` — sheet w/ LIVE badge, note, gym | gym presence realtime (`useGymPresence`, `useRealtime`) + new spot-sheet UI | new (presence data existing) |
| Live-strip item (offline friend) | live strip | `openUserProfile(uid)` | push `/user/[username]` | existing |
| `Profile` button | spot sheet | `closeSheet(); openUserProfile(uid)` | `/user/[username]` | existing |
| `Send a spot 👊` button | spot sheet | `sendSpot(uid)` — marks `spotState[uid]`, toast `You spotted {name} 👊`, strip label → `◎ spotted` | new "spot" nudge: write + push notification to friend (`lib/notifications`) | new |
| Post avatar / username block | post header | `openUserProfile(post.user)` | `/user/[username]` | existing |
| Video media tap | video posts | `playVideo(id)` — plays, progress bar 0→100% | expo-video inline playback in `FeedPostCard` | new (no video posts today) |
| Before/after slider (drag) | compare posts | `dragCompare(id, value)` via hidden `<input type=range>` — live clip-path + divider | PanResponder/Gesture slider over two images | new |
| Add-reaction button (dashed circle camera) | reactions row | `openReactionCapture(postId)`; guards: not posted → toast `Post today to react`; already reacted → toast `Reaction already added` | camera-selfie reaction flow (replaces emoji-only `useToggleLike`) | new (reactions table existing via `usePostReactions`; selfie capture new) |
| Reaction shutter | reaction sheet | `captureReaction(postId)` — flash, save, toast `Live reaction added` | capture front photo → upload → insert reaction row | new |
| Reaction chips stack | reactions row | hover title only (names) | tap → viewers/reactors list (`usePostViewers` pattern) | existing (partial) |
| Comment toggle (icon + count) | reactions row right | `toggleComments(postId)` — expands inline block | inline comments UI | new (no comments system in app) |
| Comment text input | expanded comments | Enter key → `sendComment(id)` | comments insert mutation + realtime | new |
| Comment send button (white circle) | comments input row | `sendComment(id)` — appends `{u:'me', time:'now'}`, toast `Comment posted` | same | new |
| `HIDE COMMENTS` | bottom of comments | `toggleComments(id)` | collapse | new |
| Lock CTA `Post today's SPOTTED` | locked-feed overlay card | `openCamera()` | open camera; lock state = no post today (`useFeed` + today's-post check) | new (lock/blur mechanic not in app) |
| Feed scroll | screen | native scroll | FlashList | existing |

---

## 3. Friends tab

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| `Messages` / `Find Friends` segment | under title | `setFriendsTab(t)` | two-pane friends screen | new (current friends.tsx differs; underlying data existing) |
| Inbox row (DM or group) | Messages list | `openConvo(cid)` — pushes conversation panel, clears unread | `/chat/[id]` + `useMarkConversationRead` | existing (groups **new** — only 1:1 `useConversation(otherUserId)` today) |
| Back button | conversation panel head | `popPanel()` | router back | existing |
| Message input | conversation input bar | Enter → `sendMsg(cid)` | `useSendMessage` | existing |
| Send button (white circle) | conversation input bar | `sendMsg(cid)` — appends bubble, updates inbox preview `You: {t}` / `now`, autoscrolls | `useSendMessage` + `useMessagesRealtime` | existing |
| Search input `Search people` | Find Friends | `filterFind()` — live client-side filter of all rows; hides section labels; empty state | search query against profiles (server or client) | existing (partial — suggestions exist; live search UX new) |
| Find row (person) | all four sections | `openUserProfile(uid)` | `/user/[username]` | existing |
| `Add` button | find rows / profiles | `cycleRel: none→requested`, toast `Friend request sent` | `useSendFriendRequest` | existing |
| `Added` button | find rows | `requested→none`, toast `Request withdrawn` | cancel pending request mutation | new (no withdraw today) |
| `Add Back` button | find rows (incoming) | `incoming→friend`, toast `You and {name} are now friends` | `useRespondToRequest` (accept) | existing |
| `Following` button | find rows | `following→none`, toast `Unfollowed` | one-directional follow model | new (only mutual friendships exist) |
| `✓ Friends` pill | find rows | inert | display state from `useFriendshipStatus` | existing |
| Sections: Mutual friends / Nearby / Suggested / From your contacts | Find Friends | static grouping | `useFriendSuggestions` (mutual/nearby need geo + mutual-count queries; contacts needs contact-permission import) | new (suggested existing; nearby/mutual-count/contacts new) |

---

## 4. Camera — daily flow

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Close (✕) | cam top-left | `closeCamera()` | dismiss camera | existing |
| Flip camera | cam top-right | `toast('Camera flipped')` | `useSpottedCamera` position toggle | existing (mock behavior mock-only) |
| Shutter (capture 1: back) | cam bottom | `dailyCapture()` — flash, step→capture2 | back-camera capture (`lib/camera.ts`) | existing |
| Shutter (capture 2: front) | cam bottom | flash, step→review | front-camera capture (sequential two-shot flow) | existing (partial — verify sequential UX) |
| Shot-1 thumbnail | top-left during capture 2 | display only | show first capture | new (UI) |
| `Daily` / `Max lift` mode pills | under shutter | `setCamMode(m)`; Daily disabled+`Daily ✓` once posted; Max lift disabled until posted (toast `Post your daily first`) | camera mode switch + daily-post gating | new |
| Back arrow (review) | review top-left | `cam.step='capture1'` — retake both | retake flow | new (UI) |
| `Continue ›` | review bottom | `cam.step='compose'` | proceed to compose | new (UI) |

## 5. Camera — compose & sheets (both modes)

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Back arrow | compose head | to `review` (daily) / `liftmeta` (lift) | back nav | new |
| `Gym` opt-row | compose Details | `openGymSheet()` | location picker | new (geofence/`useGeofence` + gyms table existing as data source) |
| Gym choice row (mapped gym) | gym sheet | `pickGym(id)` — selects, closes, **filters ineligible gym-communities** | set post gym_id; enforce community eligibility | new |
| `Home gym` choice | gym sheet | `pickGym('home')` — altLoc "Home gym" | unmapped location flag | new |
| `Other / unlisted` choice | gym sheet | `pickGym('other')` — altLoc "Unlisted location" | unmapped location flag | new |
| `Tag friends` opt-row | compose | `openTagSheet()` | tag picker | new (no tagging) |
| Friend tag row | tag sheet | `toggleTag(uid)` — multi-select check-ring | post_tags relation | new |
| `Done` (tag sheet) | tag sheet | close + rerender | — | new |
| `Music` opt-row | compose | `openMusicSheet()` | track picker | new (no music feature) |
| Track row | music sheet | `pickMusic(i)` — single select, closes | store track metadata on post | new |
| `No music` row | music sheet | clears selection | — | new |
| `Communities` opt-row | compose | `openCommSheet()` | community cross-post picker | new (no communities) |
| Community row | communities sheet | `toggleComm(id)`; gym-type disabled unless at that gym (`You must be at this gym to post here`) | post_communities relation + location gate | new |
| `Done` (comm sheet) | communities sheet | close + rerender | — | new |
| Caption textarea | compose | `oninput` → `cam.caption` | post caption | existing (posts have captions) |
| `Preview post` | compose bottom | `goPreview()`; guard: no gym → toast `Choose a gym or location first` + open gym sheet | validation + preview step | new |
| `Edit` | preview actions | back to compose | — | new |
| `Publish` | preview actions | `publishPost()` — daily: save post, `markPostedToday()` (localStorage date key), unlock feed, posted-dot, navigate home, toast `Posted. Feed unlocked.`; lift: save lift post, prepend achievement, toast `Max-lift video posted` | create post mutation (`lib/storage` upload + posts insert); daily-flag server-side; localStorage persistence is mock-only | new (post creation existing in camera tab; daily-lock/lift semantics new) |

## 6. Camera — max-lift flow

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Shutter (record toggle) | lift cam | `toggleRec()` — start: rec state + 1s interval timer `0:SS`; stop: flash → liftmeta | expo-camera video recording | new |
| Rec timer pill | above shutter | interval counter | recording duration display | new |
| Lift choice rows (`Bench press`/`Squat`/`Deadlift`) | liftmeta | `cam.lift = l` single-select | lift metadata on post | new |
| Weight chips (`225 lb`…`315 lb`) | liftmeta | `cam.weight = w` | weight metadata (real app: numeric input) | new |
| `Continue` | liftmeta | step→compose | — | new |
| Back arrow (liftmeta) | head | step→capture1 | — | new |

---

## 7. Map tab — Communities list

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| `Communities` / `Map` segment | under title | `setMapTab(t)` (title text switches too) | two-pane map screen | new (map exists; communities pane new) |
| Weekly challenge card | "This week" | `openChallengeSheet()` | gym-vs-gym weekly challenge feature | new |
| Contributor row | challenge sheet | close + `openUserProfile(u)` / own → profile tab | profiles | existing |
| `◎ Check in at Gold's — count me in` | challenge sheet | `chalCheckIn()` — increments team + personal score, toast `Checked in — +1 for Gold's` | check-in write + challenge scoring | new |
| Community card | Your gyms / Your communities | `openCommunity(id)` — pushes community panel (default Posts tab) | community page route | new |
| Chat shortcut (bubble icon on card) | community card right | `event.stopPropagation(); openCommunity(id,'chat')` | deep-link to community chat tab | new |

## 8. Community page (panel)

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Back | panel head | `popPanel()` | router back | existing |
| `Posts` / `Chat` / `Rankings` tabs | under hero | `setCommTab(id, t)` (Rankings only on gym communities) | community sub-tabs | new |
| Post grid cell | Posts tab | `openUserProfile(user)`; own cell → `navToProfileFromComm()` (clear panels + profile tab) | post detail or author profile | new |
| Chat input + send | Chat tab | `sendCommMsg(id)` — appends bubble, stores in `COMM_CHAT` | community group chat (realtime channel) | new |
| Rank category chips (`Max lifts`/`Streaks`/`Friends`/`Trophies`) | Rankings | `rankCat[id]=k; renderCommunityBody(id)` | leaderboard queries | new |
| Lift chips (`Bench press`/`Squat`/`Deadlift`) | Rankings (Max lifts) | `rankLift[id]=k` | per-lift leaderboard | new |
| Rank row | Rankings | `openUserProfile(u)` / own → profile tab | profiles | existing |

## 9. Map view

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Gym marker (44px circle, member count, live pulse) | map | `openGymPreview(id)` | map markers → gym sheet (current app has map + `/gym/[id]`) | existing (partial — live pulse + count badge new) |
| Map pan/zoom | map | none (static SVG) | react-native-maps dark style | existing |
| `◎ Check in` | gym sheet actions | `checkInGym(id)` — adds self to `liveNow`, dupe→toast `Already checked in here`, toast `Checked in at {gym}`, refresh sheet+map | manual check-in write feeding presence/streak/challenge | new (auto presence via `useGymPresence`/geofence existing; explicit check-in action new) |
| `Join` / `✓ Joined` | gym sheet actions | `toggleJoinGym(id)` — toggles membership, toast `Joined/Left {gym}`, creates gym community entry (`ensureGymCommunity`) | gym membership (home-gym relation) + community membership | new |
| `Community` | gym sheet actions | `closeSheet(); openGymCommunity(id)` (creates community record if missing) | open gym community page | new |
| Here-now row (`{n} friends here now · tap to see who`) | gym sheet | `toggleHereList(id)` — expand list, caret rotates | presence list (`useGymPresence`) | existing (partial — expandable UI new) |
| `Wave` chip per friend | here-now list | `stopPropagation`; text swap `Wave` → `◎ Waved` | wave nudge + push notification | new |
| Sheet backdrop | overlay | `closeSheet()` | dismiss | existing |

---

## 10. Profile (own)

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Pinned trophy chip | pin row | `openTrophy(id)` | trophy detail | new (no trophies) |
| `Friends` count cell | counts row | `openFriendsList()` — sheet of friends → profiles | `useFriends` list | existing (sheet UI new) |
| `Following` count cell | counts row | `openFollowingList()` — sheet → profiles | following list | new (follow model) |
| `STATS` quad | quad grid | `openProfSection('stats')` — panel w/ streak, daily posts, verified PRs, best lifts + ranks, community standing | `useStreak`, `useUserPosts`, new PR/rank queries | new (streak/posts existing; verified PRs + ranks new) |
| `TROPHIES` quad | quad grid | `openProfSection('trophies')` — 2-col trophy grid | trophies feature | new |
| `VIDEOS` quad | quad grid | `openProfSection('videos')` — achievements grid | max-lift video archive | new |
| `POSTS` quad | quad grid | `openProfSection('posts')` — monthly calendar archive | `useUserPosts` grouped by month w/ missed days | new (data existing; calendar UI + missed-day logic new) |
| Trophy card | trophies panel | `openTrophy(id)` | trophy detail | new |
| Proof media card | trophy detail | `openAchievement(id)` / `openDailyPost(id)` | linked post detail | new |
| Achievement card | videos panel | `openAchievement(id)` — detail w/ play + caption | `/post/[id]`-style detail | new |
| Calendar cell | posts panel | `openDailyPost(id)`; today's → `openMyTodayPost()` | `/post/[id]` | existing (route) / new (calendar) |
| Missed-day cell | posts panel | inert (✕) | display | new |

## 11. Other-user profile (panel)

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Back | head | `popPanel()` | router back | existing |
| Relationship button | under identity | `cycleRel(uid)` — same state machine as §3; re-renders in place (`refreshOpenProfile`) | `useFriendshipStatus` + request mutations (+ follow = new) | existing (partial) |
| Mutuals strip | under rel button | `openMutualsSheet(uid)` — sheet `You and {name} both know` | mutual-friends query | new |
| Mutual row (sheet) | mutuals sheet | close + `openUserProfile(m)` | `/user/[username]` | existing |
| Their post cards | Recent posts | full post interactions (§2) | `useUserPosts` | existing |
| Gated empty state | no posts / not friends | text `Posts unlock when you're friends.` | friends-only visibility rule | existing (partial — verify RLS) |

---

## 12. Global / system

| Element | Location | Mockup behavior | Maps to | Status |
|---|---|---|---|---|
| Toast | bottom-center | `toast(text)` — 2.1s white pill | toast lib (add) | new (UI primitive) |
| Flash | full-screen | `flash(cb)` — 90ms white | capture feedback overlay | new (UI primitive) |
| Sheet backdrop tap | any sheet | `closeSheet()` | bottom-sheet dismiss | existing (pattern) |
| `hasPostedToday` / `markPostedToday` | state | localStorage date key, resets at local midnight | server-derived "posted today" (query today's post) — localStorage is mock-only | new |
| Fake status bar, device frame, stage header | chrome | display only | — | mock-only (SKIP) |
| Simulated photos/silhouettes, mock data (`USERS`, `GYMS`, `FRIEND_POSTS`, …) | everywhere | demo content | real Supabase data | mock-only |
| Camera-flip toast, 4.1s fake video progress, scan-line "camera", localStorage persistence | various | demo stand-ins | real camera/video/upload | mock-only |

---

## Counts

- **Screens/states documented**: 4 tabs (+2 sub-tabs each on Home/Friends/Map), locked feed, camera ×2 flows ×4–5 steps, 11 sheets, 10 pushed panels ≈ **30 distinct screens/states**.
- **Interactive elements mapped**: **~95** rows above (unique element types; list rows counted once).
- **Status split (approx.)**: existing ~30 · new ~55 · mock-only ~10.

---

## Addendum — 2026-07-18 bugfix session

- **Community creation is now REAL end-to-end.** Applied migrations `communities_wizard` + `trophy_rarity` to live DB (they existed on disk but were never applied — this was why "Create Community" silently did nothing: the insert referenced columns/types the DB did not have). `communities` now has `description/photo_url/privacy/location`, all 8 types allowed, creator UPDATE policy, `community_join_requests` table + `respond_join_request()` RPC live.
- `community-new` is no longer a native modal (native modals covered the root toast host, hiding errors). Now a fullscreen card: header sits at the safe area, toasts visible, plus inline error text under the CTA, KeyboardAvoidingView + drag-to-dismiss keyboard.
- **PhotoEditor**: draw gesture runs on the JS thread (`runOnJS(true)`) — the worklet version crashed Expo Go. Rotate + new crop presets (1:1 / 4:5 / 9:16) are real pixel ops via expo-image-manipulator. Editor is wrapped in `EditorBoundary` — a crash shows a friendly recovery screen, never kills the app.
- **Max-lift video is now REAL**: expo-camera `recordAsync` (60s cap, mic permission asked on mode switch, records muted if denied), real playback via expo-video, trim bar with draggable start/end handles (`components/camera/LiftVideoReview.tsx`). Trim is a soft range (start/end seconds) kept in `videoTrimRef` — actual file cutting + video upload still belongs to the backend pass.

## Addendum — 2026-07-18 live-testing bug-fix pass (approved checklist)

DB (applied live + files in supabase/migrations 20260719_03x):
- story_views UPDATE policy + client ignoreDuplicates (was erroring on every repeat story view)
- post_reactions.reaction nullable; selfie upsert omits reaction; like query filters by 🔥
- posts.location_kind (gym/home/other) + music_clip_start; post_tags table + RLS
- notification_type += new_follower, community_invite; triggers on friendships (request/accept), follows (new follower), community_invites (invite w/ community name payload); respond_community_invite RPC
- posts_select_visible: public-visibility profiles' posts readable by all (real Public feed)

Client:
- Camera: location permission now actually requested; Home Gym bypasses 0.2mi geofence (posts show "Home Gym"); caption has Done key + drag-dismiss; tags saved to post_tags and shown as "with @x" chips
- Feed: fixtures deleted; Friends tab = you+friends, Public = all RLS-visible; per-tab empty states
- Stories: neighbor prefetch + zero-transition swaps; interactive swipe-down dismiss (follows finger, scale, velocity); story review swipe cycles filters (baked via view-shot on share)
- Editor: elements selectable (dashed outline), drag-to-trash or tap trash to delete, tap text to re-edit content/color
- Music sheet: audible audition on tap + clip-start scrubber (0-30s window), stored in music_clip_start, feed chip plays from clip start
- Keyboard: sheets slide above keyboard (interactive); chat/community-new drop bottom inset while keyboard open (useKeyboardVisible)
- Inbox: renders new_follower + community_invite (Join/Ignore inline); community page has Invite friends sheet

## Addendum — 2026-07-19 second bug-fix pass

- **Follow removed entirely** (single friends model, per approved recommendation): no Follow button, no follower/following lists, follower-notification trigger dropped. `follows` table left inert in DB.
- **Video posting is REAL**: was a mock toast — now uploads the clip (720p cap) + inserts a video post with soft-trim window + lift name/weight columns. Feed plays it via expo-video (tap play/pause, loops inside trim, duration chip). Compose/liftmeta show real first-frame thumbnails.
- **Multi-photo posts**: "Add" button on daily review banks shots (max 4); `posts.media_urls[]`; feed renders a swipeable carousel with dots + 1/N counter.
- **Instant shutter**: flash fires at tap, `skipProcessing`, shutter animation disabled.
- **Chat**: big tappable avatar+name header; photo messages (picker → messages bucket → signed-URL image bubbles); voice messages (expo-audio record → .m4a → play/pause bubble w/ progress). Added the missing messages-bucket SELECT policy (chat media was unreadable).
- **Streak taunts**: Taunt 😈 button on streak-ended notifications → 4 preset roasts → `send_taunt` RPC (friends-only, 1/day per target) → push. Renders as `roasted you: "…"`.
- **Selfies stay mirrored** (main camera front shots + reaction selfies).
- **Keyboard gap**: bottom padding drops while keyboard is open on story reply, camera compose, edit-profile (chat/community-new done previously).

## Addendum — 2026-07-20 tester pass 3

- **Feed gating fixed**: LockOverlay was box-none + light gradient over intensity-30 blur, so posts showed through. Now a near-opaque full-screen gate that captures all touches — no reading/tapping others' posts until you post.
- **Streak longest = high-water mark**: DB monotonic trigger on streaks (longest can only rise) + record_streak_high_water RPC + client bump in profile. Sweep's current=0 reset no longer drags longest down.
- **Comments are REAL**: usePostComments/useAddComment against post_comments table (was session-local mock). CommentsSheet takes CommentRow with avatars + rel time.
- **Captions bigger** (15.5 bone). **Tagged friends = tappable chips** → profile.
- **Pinch-to-zoom + double-tap-to-like**: MediaFrame wraps post media (heart burst, toggle like).
- **Music scrubber crash fixed**: all player.play()/seekTo() wrapped (threw when unready); NaN-guarded scrub. **Suggested/trending songs** section (useSuggestedTracks) when picker is empty.
- **WYSIWYG crop**: photos cropped to POST_ASPECT (5:6) at capture + CaptureFrame dims the out-of-frame area so preview == post. Fixes "cropped in half".
- **Story**: swipe-up opens reply keyboard; recyclingKey/priority/allowDownscaling for viewer perf; library-picker button in story mode only.
- **Read receipts**: "Seen Xm ago" under my last message when read_at set.
- **Profile tabs**: POSTS / TAGGED (useTaggedPosts).
- **Dual camera**: NOT possible — see notes. Needs a dev build + vision-camera multi-cam (unsupported in expo-camera / Expo Go).

## Addendum — 2026-07-20 complete trophy system

- **Two tabs only**: Categories (default) + Earned. Rarest tab and all "rarest first" sorting removed.
- **Numerical rarity everywhere**: "32% of users" / "0.6% of users" on every card, detail sheet, unlock modal, and earned card. Common/Uncommon/Rare/Legendary words gone. Sub-1% gets a gold PREMIUM cue but still shows the number.
- **Achievement data model**: TrophyDefinition / TrophyTier(rarityPct) / TrophyAchievement(per-tier earnedAt) / TrophyProgress. Every earned tier is its own record with its own date; highest tier derived, never stored on the family.
- **Catalog**: exact spec names for all families (Bench…Titan, Streak Rookie…Year of Iron, Home Turf, Holidays, etc.). New files: lib/trophyRaritySeeds.ts (per-tier %, strength-standard anchors), lib/trophyEngine.ts (idempotent deriveAchievements + deriveProgress + Easter/Thanksgiving + verifyLift stub), lib/trophySelectors.ts (category/earned/ladder views), lib/trophyStorage.ts (seen-set), hooks/useTrophies.ts.
- **Components**: TrophySegmentedControl, TrophyCategorySection, TrophyGrid, TrophyCard→Stacked/Standalone/Earned cards, TrophyRarity, TrophyDetailSheet + TierLadder/TierRow, TrophyUnlockModal (haptic scale-in), TrophyShareCard (captured image share). Locked visual foundation preserved (dark zinc, two-column grid, gold-for-earned only).
- **Earned tab**: every earned tier separate, newest-first, each with exact date + %. No locked trophies/tiers/empty sections.
- **Progress bars**: only Streaks, Weekend Warrior, Home Turf, Nomad. Strength is video-verified (no bar). No zero bars on standalone events.
- **Demo**: Day One earned (dated from first post), streak feeds the ladder; Earned tab shows only Day One unless real data qualifies more.

## Addendum — 2026-07-20 hold-to-record shutter

- Snapchat-style capture: tap = photo, press-and-hold = video, slide left onto the lock icon = hands-free recording (then tap to stop). New components/camera/ShutterButton.tsx (gesture-handler Pan with activateAfterLongPress + Tap; reanimated puck + lock reveal).
- Removed the separate "Video" mode pill — videos are recorded by holding. Camera now runs mode="video" in capture (takePictureAsync still serves tap-photo, iOS-first). Held clips route to the existing video review → compose → publishLiftVideo flow. Mic permission requested on first hold.

## Addendum — 2026-07-20 tester batch (story/camera/music/feed)

Story editing: text composer commits on tap-anywhere (was hidden Add button behind keyboard — the "can't add text" bug) + Done chip up top; element selection no longer shows a dashed artifact (soft highlight) and has a bigger multi-touch target so pinch-resize/rotate register.
Second story: "+" badge on Your Story always opens the camera (even after posting); story viewer has an "Add to story" button on your own story.
Camera: pinch-to-zoom on preview (zoom readout); flip debounced (650ms + blocked while recording) so spamming can't stall the session; removed the AUTOMATIC capture crop (photos keep full frame — cropping is user-driven only); bigger Edit button + clearer top indicator pill.
Music: clip scrubber rewritten (components/camera/MusicClipScrubber.tsx) — UI-thread knob, continuous (no 1s snapping), smooth; song title bigger.
Feed/profiles: other users' profiles now have Posts/Tagged tabs with labels; live reactions tappable → ReactionsSheet (who reacted, tap to profile); feed shows skeleton cards while loading (components/ui/Skeleton.tsx) instead of a blank screen.
Picker: story library picker uses Current representation mode (skips iOS transcode) + selectionLimit 1 for a faster return.

DEFERRED (need their own pass): freeform draggable crop TOOL to replace editor presets (auto-crop already removed, which was the core complaint); fully custom instant photo-grid picker (system picker sped up but not replaced).

## Addendum — 2026-07-20 freeform crop tool

- Replaced the editor's preset crop chips (1:1/4:5/9:16) with a real manual crop: components/camera/FreeformCrop.tsx. Image shown contain-fitted; a crop rectangle with four draggable corner handles + drag-to-move body, dimmed exterior, rule-of-thirds guides, Reset + Apply. Maps the on-screen box to source pixels and crops via expo-image-manipulator (single 0.98 re-encode). Fully user-controlled — no presets, no automatic crop anywhere in the pipeline.

## Addendum — 2026-07-20 batch 3 (permissions, moderation, story viewers)

- Location permission: only auto-prompts ONCE per app session (module-scoped guard) — no more re-prompt on every camera open when the grant was "Allow once". Denied falls back to no coords silently.
- Profile "y" flash: StoriesRail shows a skeleton circle until the profile resolves instead of the "You" fallback initial (that was the "y").
- Story viewers: "Seen by" on your own story → inline viewers list (most-recent first) via story_views_select_owner RLS + useStoryViewers. Story viewer uses local overlays (it's a fullScreenModal above the global sheet host).
- Story element editing: removed the translucent selection background artifact — elements sit clean on the photo now.
- Reactions: usePostReactionSelfies exposes the emoji; ReactionsSheet always shows WHAT they reacted with (emoji, or selfie thumb + camera glyph, or 🔥).
- Delete + report: kebab (⋯) on posts (feed, global sheet) and stories (inline overlay). Own content → Delete (confirm); others' → Report with reasons. New reports table + RLS (App Store UGC moderation), useContentModeration (useDeletePost/useDeleteStory/useReportContent), ContentMenu + ReportSheet components.

## Addendum — 2026-07-20 batch (stories/messaging/trophies/feed/camera)

- Story reply previews: reply DMs carry the story media path (messages.reply_story_media) → chat renders an IG-style story thumbnail above the reply.
- In-app banners: DMs + taunts pop a top banner while the app is foregrounded (stores/banner + NotificationBanner host + useInAppBanners realtime on messages/notifications).
- Trophy cascade: confirmed inherent (value-based earning cascades to all lower tiers) + tests added.
- Friends' trophies: useTrophies(userId) parameterized; friend profile "Trophies" stat opens their read-only case (/profile-section/trophies?user=&name=).
- Comments: fixed tall sheet (85% screen height) — no more content-sized layout gap; list flexes to fill.
- Public feed: now ONLY people you haven't added (friends stay in Friends tab); pull-to-refresh reshuffles order (seeded shuffle).
- Home scroll-to-top: tapping the Home tab on the feed scrolls to top (useScrollToTop).
- Video autoplay: feed videos autoplay muted while the post is the active/visible one (IG-style), tap to pause; unified with music autoplay via one active-post tracker.
- Camera grid removed (RuleOfThirds gone).
- Notifications grouped Today / Yesterday / Last week; anything >7 days filtered client-side + daily pg_cron sweep (notifications_cleanup_sweep).

DEFERRED / PLAN: story cube/slide transition (needs its own focused animation pass).

## Addendum — 2026-07-20 batch 5 (posting-flow rework, story tags, video fix)

- Video recording fix: the picture→video mode switch used a fixed 400ms delay and called recordAsync mid-reconfigure, which could hang and record nothing. Now `key={camMode}` remounts CameraView on mode change, `onCameraReady` flips `videoReadyRef`, and startRecording waits (bounded 2.5s) for readiness before recordAsync. Root cause: expo-camera can't do photo+video simultaneously — switching mode reconfigures the session.
- Posting-flow gating: until the daily photo is posted, video is blocked ("Post your daily photo first to unlock video posts"). Daily = photo only (videos are always non-daily lift posts). Hold-to-record Snapchat UX kept with the "TAP FOR PHOTO · HOLD FOR VIDEO" hint.
- Workout entry → trophies (honor system): lift-video compose has a "Log your lift" step — pick exercise from the trophy-derived catalog (lib/liftCatalog.ts: bench/squat/deadlift = lb, pullups/pushups = reps), enter the number. **Posting is the unlock trigger** (not entry — the video is the social receipt). On publish, useLogLift inserts a user_lifts row; newlyUnlockedTiers computes the cascade (a first-logged 275 bench earns all lower tiers); crossed tiers fire TrophyUnlockModal before navigating to feed. Best-per-exercise feeds useTrophies via useUserLifts (works for friends too — trophy cases are visible on friends' profiles).
- Geofence: only dailies are geofenced; lift videos post from anywhere.
- Story tags: "Tag friends" pill on the story review screen (reuses FriendsSheet) → story_tags rows on publish. The story viewer renders tappable "with @username" chips (lucide Users glyph) that close the viewer and open /user/<username>, consistent with post tags.
- Schema: migration user_lifts_and_story_tags — user_lifts table (exercise/value/unit/post_id, RLS insert-self / select self-or-friends), story_tags table (story_id/user_id PK, RLS insert-delete-owner / select owner-or-friends), posts.lift_exercise/lift_value/lift_unit.

## Addendum — 2026-07-21 design overhaul + My Workouts (Parts 1-5)

- Tokens: `theme/tokens.ts` — semantic bg/border/text + gold (kept #E8B44C) + goldSubtle, radius {sm12,md16,lg24,pill}, space scale. Gold already single-sourced via colors.gold.
- Sizing: tab icons 28px + 48px targets, camera FAB 76px / 1.5px border.strong ring + gold "posted" dot, notification bell 26px / 44px target, map nav icon → Dumbbell.
- Feed: lift stat pill redesigned (gold Trophy glyph + title-case name + gold-mono value on translucent bg.base plate; removed last 🏆 UI emoji); stories row (84px avatars, 3px ring + 3px gap, gold/strong ring, 28px gold plus badge, Geist labels); post cards use a 16px bg.base gap (no hairline), username 15px, 14px location, tertiary timestamp/overflow; Segmented → 44px, radius.lg, white/black selected, text.secondary unselected.
- Profile: Trophies button 52px radius.md bg.raised + gold icon + chevron; POSTS/TAGGED tabs Geist 600 12px caps, active text.primary + underline; empty states get an icon; grid already 2px gutters / real-posts-only.
- Bugs: (5a) long-press own reaction → remove (scoped DELETE + optimistic); (5b) reaction avatars always render real pfp for emoji/text reactions; (5c) video posts show generated poster thumbnails + play badge (expo-video-thumbnails, posts.thumbnail_url), bg.subtle+play fallback for un-generated/old videos.
- My Workouts: new default far-left tab on the Dumbbell nav; full builder at /workout (workouts table, ~150-exercise library, save→PR→trophy cascade). Video ungated at camera open (composer C3).

DEFERRED: calendar (4a) finer tweaks; video poster backfill for pre-existing posts; full mono purge on untouched screens.
