# Instant-UX Plan — Skeletons, Caching, Optimistic Rendering

> Full-repo audit completed 2026-08-02 (3 deep scans: loading states, caching architecture, mutations).
> Goal: no spinners on data loads (gray skeleton bars instead), screens render instantly from cache
> on revisit **and app relaunch**, and every routine button updates the UI immediately.

The three workstreams multiply each other: with caching (A), skeletons (B) only ever show on a
true first visit; with optimism (C), buttons never wait. **Recommended order: A → B → C.**

---

## Phase A — Caching foundation

### A1. Persist the React Query cache (MMKV)
Today the cache is memory-only (`app/_layout.tsx:149-161`, only `staleTime: 30s`, `retry: 1`) and
every query falls to the default **5-min gcTime** — nothing survives relaunch or a >5-min tab
switch. `react-native-mmkv` is already installed with a ready, **unused** store (`lib/storage.ts`).

- Add `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`.
- Build `lib/queryPersister.ts`: sync persister over the existing MMKV instance (`spotted-cache`).
- Swap `QueryClientProvider` → `PersistQueryClientProvider` in `app/_layout.tsx:191`:
  - `maxAge: 24h`, `buster: appVersion` (drop stale cache shape on updates)
  - `dehydrateOptions.shouldDehydrateQuery`: persist successful queries EXCEPT ephemeral/
    presence keys: `live-presence`, `activity-status`, `crew-activity`, `gym-presence`,
    `review-queue`, `message-reactions`, `track-search`, `people-search`, `story-viewers`,
    `story-likers`, `post-viewers`.
- Global `gcTime: 24h` (staleTime stays 30s → instant paint from cache, silent background refetch).
- **Logout safety** (`stores/auth.ts` sign-out path): `queryClient.clear()` + persister
  `removeClient()` + clear the signed-URL MMKV mirror (A2) — no cross-account leakage.
- Retire `hooks/useProfileCache.ts` (its 3-key AsyncStorage snapshot becomes redundant) — remove
  after the persister proves out, in the same PR to avoid double-seeding conflicts.

### A2. Persist the signed-URL cache (the image-cache killer)
`lib/supabase.ts:83-124` keeps signed URLs stable for ~5.5h — but in memory only. On relaunch every
path re-signs → **new token → new URL → expo-image disk-cache miss on all post media**.

- Mirror `signedUrlCache` entries (`{path, url, at}`) into MMKV; hydrate the Map at module init;
  write-through on set. Reuse window unchanged (expiry−30 min).
- Give `signedMessageUrl` (`lib/supabase.ts:180`) the same cache treatment (currently re-signs
  every call; chat queries mask it for only 50 min).

### A3. expo-image hygiene
- New `components/ui/CachedImage.tsx`: expo-image with defaults `cachePolicy="memory-disk"`,
  `transition={140}`; callers pass `recyclingKey` in recycled lists.
- Sweep the "plain" call sites found in the scan to CachedImage: `components/PumpCard.tsx:27`,
  `post/PostCard.tsx:431,470`, `post/ReactionsSheet.tsx:48,61`, `post/MusicChip.tsx:112`,
  `profile/media.tsx:74,151`, `profile/StreakCalendar.tsx:291`, `app/chat/[id].tsx:142,206,241`,
  `post/PostMedia.tsx:483` (video poster), `components/FeedPostCard.tsx:68` (legacy card).
- Add `cachePolicy="memory-disk"` to `post/ScenePhoto.tsx:41-51` (has recyclingKey+transition,
  missing cachePolicy — this is the main feed photo surface).
- **Migrate `components/ui/Avatar.tsx` from RN `Image` → expo-image** (`memory-disk`): avatars are
  public stable URLs, this makes every avatar in the app effectively instant.

### A4. Prefetch warm-ahead (small, high leverage)
- On feed page load, `queryClient.prefetchQuery` the own-profile bundle; on tapping a post author,
  prefetch `["profile","username",u]`. No `prefetchQuery` exists anywhere today.

**Phase A acceptance:** relaunch app → feed/profile/chat render content immediately (stale data,
background refresh); airplane-mode relaunch still shows last content; log out → log in as another
account shows zero residue.

---

## Phase B — Skeleton system

### B1. Library (extend `components/ui/Skeleton.tsx`)
Base `Skeleton` already exists (graphite `#131315` pulse 0.4↔0.85, 900ms) plus `PostCardSkeleton`
(only used in feed). Add, all built on the same primitive, staggered-free (one shared pulse):

| Component | Shape | Used for |
|---|---|---|
| `SkeletonRow` | avatar circle (sz prop 34/40/44) + 2 bars (60%/40%) | people/inbox/members/requests lists |
| `SkeletonGrid` | n cells, 3-col, `aspectRatio 4/5` | profile grids, tagged, archives, community posts |
| `SkeletonChatBubbles` | 6 alternating L/R rounded bars (55-75% widths) | DM thread, community chat |
| `SkeletonWorkoutRow` | icon square + title bar + right stat bar | workout lists |
| `SkeletonToggleRows` | text bar + pill toggle, ×n | settings/notifications |
| `SkeletonHeaderDetail` | 68px square + 2 bars, then body slot | community screen, workout detail |
| `SkeletonMediaCard` | full-width media block + meta bars | moderation review queue |
| `SkeletonCommentRow` | 28px avatar + 2 bars (indent prop) | comments sheet |
| `SkeletonTrackRow` | art square + 2 bars | music picker |

Rule of scope: **replace data-loading indicators only.** Keep: `Button loading` submit spinners,
upload/publish spinners (`camera.tsx:1711,1859`), camera hardware init, `RefreshControl`s
(feed:206, profile:140), the auth splash gate (`app/index.tsx:18`), map tile spinner.

### B2. Conversion table (every site from the scan)

| Screen | file:line | Today | Replace with |
|---|---|---|---|
| Feed pagination footer | `(tabs)/feed.tsx:268` | ActivityIndicator | 1× compact `PostCardSkeleton` |
| Map: recent workouts | `(tabs)/map.tsx:452` | spinner | 3× SkeletonWorkoutRow |
| Map: crews list | `map.tsx:661` | spinner | 3× SkeletonRow(34) |
| Map: discover | `map.tsx:886` | spinner | 3× SkeletonRow(34) |
| Map canvas gate | `map.tsx:902` | spinner | keep (graphite backdrop already) |
| Profile: posts grid | `(tabs)/profile.tsx:433` | "Loading…" text | SkeletonGrid(9) |
| Profile: tagged grid | `profile.tsx:457` | text | SkeletonGrid(6) |
| Profile: split tab | `profile/WeeklySplit.tsx:113` | blank rows | 7-day SkeletonWorkoutRow variant |
| Friends: DM list | `(tabs)/friends.tsx:356` | **blank** | 5× SkeletonRow(40) |
| Friends: suggestions | `friends.tsx:470` | text | 3× SkeletonRow(40) |
| Onboarding gym search | `(onboarding)/home-gym.tsx:164,191` | spinner+text | 4× SkeletonRow(0 avatar, name+distance bars) |
| Chat thread | `chat/[id].tsx:745` | "LOADING…" text | SkeletonChatBubbles |
| Inbox activity | `inbox.tsx:330` | spinner | 5× SkeletonRow(40, wide text) |
| Message requests | `message-requests.tsx:33` | spinner | 3× SkeletonRow(40) |
| Story viewer gate | `story.tsx:551` | spinner | full-screen graphite block |
| Story media load | `story.tsx:587` | spinner behind image | full-frame Skeleton |
| Story seen-by sheet | `story.tsx:958` | spinner | 4× SkeletonRow(34) |
| User profile: tagged | `user/[username].tsx:412` | text | SkeletonGrid(6) |
| Profile posts pager | `profile-posts/[postId].tsx:128` | "Loading…" | 2× PostCardSkeleton |
| Daily date view | `daily/[date].tsx:121` | "Loading…" | 2× PostCardSkeleton |
| Archive section | `profile-section/[section].tsx:84` | text | SkeletonGrid (daily-cell variant) |
| Post viewers | `post/[id].tsx:20` | text | 4× SkeletonRow(34) |
| Gym screen presence | `gym/[id].tsx` | **silent blank** | 3× SkeletonRow(40) while presence loads |
| Community screen gate | `community/[id]/index.tsx:147` | full spinner | SkeletonHeaderDetail + SkeletonGrid |
| Community invite list | `community/[id]/index.tsx:57` | spinner | 3× SkeletonRow(40) |
| Community posts tab | `index.tsx:340` | text | SkeletonGrid(6) |
| Community chat tab | `index.tsx:376` | text | SkeletonChatBubbles |
| Community members | `members.tsx:35` | spinner | 5× SkeletonRow(44) |
| Community settings gate | `settings.tsx:153` | spinner | form skeleton (photo square + 3 field bars) |
| Community join requests | `settings.tsx:248` | text | 3× SkeletonRow(40) |
| Settings review queue | `settings/review.tsx:40` | spinner | 2× SkeletonMediaCard |
| Settings blocked | `settings/blocked.tsx:41` | spinner | 4× SkeletonRow(40) |
| Settings restricted | `settings/restricted.tsx:41` | spinner | 4× SkeletonRow(40) |
| Settings notifications | `settings/notifications.tsx:352` | spinner | SkeletonToggleRows(8) |
| Workout detail gate | `workout/[id].tsx:72` | spinner | SkeletonHeaderDetail + set-row bars |
| Comments sheet | `post/CommentsSheet.tsx:189` | text | 3× SkeletonCommentRow |
| Camera: gym picker | `camera.tsx:324` | spinner | 4× SkeletonRow |
| Camera: friend tags | `camera.tsx:392` | spinner | 4× SkeletonRow(40) |
| Camera: music suggested | `camera.tsx:485` | spinner | 4× SkeletonTrackRow |
| Camera: music search | `camera.tsx:506` | spinner | 4× SkeletonTrackRow |

**Phase B acceptance:** with cache cleared (fresh install), every route above shows gray pulsing
placeholder shapes matching its content layout; no ActivityIndicator appears anywhere except the
keep-list; with warm cache, skeletons are never visible.

---

## Phase C — Optimistic rendering

Recipe for every conversion (matches the 11 already-optimistic hooks in the codebase, e.g.
`useToggleLike` at `usePostReactions.ts:38`):
`onMutate`: `cancelQueries` → snapshot → `setQueryData` → return ctx · `onError`: rollback + toast ·
`onSettled`: targeted `invalidateQueries`.

### C-P1 — daily-use interactions (highest value)
| Mutation | file:line | Optimistic change |
|---|---|---|
| Add comment | `usePostComments.ts:53` | insert temp row (`temp-<ts>`, own avatar) into `["post-comments",postId]`; replace on success |
| Delete comment | `usePostComments.ts:72` | remove row immediately |
| Send DM (real path) | `useMessages.ts:99` | port the existing mock-mode temp-row insert (`:130`) to `["messages",conversationId]`; pending tick until reconciled |
| Send media DM | `useMessages.ts:172` | temp bubble with local URI + upload progress state |
| Community chat send | `useCommunities.ts:161` | same temp-row pattern into `["community-messages",id]` |
| React to message | `useMessagesExtras.ts:37` | flip in `["message-reactions",convId]` |
| Unsend message | `useMessagesExtras.ts:65` | mark deleted in cache instantly |
| Join community | `useCommunities.ts:304` | `["community",id]`.isMember=true + add to `["my-communities"]`; button flips to Joined instantly |
| Leave community | `useCommunities.ts:319` | inverse of join |
| Request to join | `useCommunities.ts:454` | `["community-my-request",id]`="pending" instantly |
| Join gym community | `useCommunities.ts:292` | same as join (`GymPreviewSheet.tsx:79` button becomes instant) |
| Add reaction selfie | `usePostReactionSelfies.ts:78` | mirror existing optimistic remove (`:122`): temp selfie w/ local URI |
| Send friend request | `useFriends.ts:175` | suggestion row → "Requested" instantly |
| Block/unblock/restrict/unrestrict | `useSafety.ts:67-95` | flip target list caches immediately |
| Chat block | `useMessagesExtras.ts:137` | flip `["blocked-users"]` instantly |
| Mute conversation | `useMessagesExtras.ts:411` | flip `["conversation-muted",…]` |
| Move thread to folder | `useMessagesExtras.ts:373` | move in `["inbox-threads"]` cache |

### C-P2 — feedback loops & perf wins
| Mutation | file:line | Change |
|---|---|---|
| Mark story viewed | `useStories.ts:224` | set `seen` locally in `["stories"]`; **drop the full invalidate** (currently re-fetches+re-signs the whole rail per story) |
| Mark post viewed | `useFeed.ts:125` | **drop `["feed"]` invalidate** (re-signs every photo today); local flip only |
| Notifications read | `useNotifications.ts:80` | zero the badge + mark rows read in cache instantly |
| Wave | `useCommunitiesHome.ts:74` | UI already flips locally (`waved` set) — add rollback on error |
| Nudge | `useCommunitiesHome.ts:252` | button → "Nudged" instantly, rollback on 24h-limit error |
| Taunts | `useTaunts.ts:24`, `inbox.tsx:95` | instant "Sent", rollback on error |
| Featured trophies / split public / visibility | `useProfileExtras.ts:32,49,62` | merge into `["profile"]` cache |
| Respond message request | `useMessagesExtras.ts:222` | remove request row instantly |
| Respond community invite / join request | `useCommunities.ts:505,522` | remove row instantly |
| Story reply | `app/story.tsx:55` | write sent message into `["messages"]`/`["inbox-threads"]` cache |

### C-P3 — destructive & heavy (careful, keep confirmation UX)
| Mutation | file:line | Change |
|---|---|---|
| Delete post | `useContentModeration.ts:7` | remove from `["feed"]`/`["signed-user-posts"]` instantly after confirm |
| Delete story | `useContentModeration.ts:29` | remove from `["stories"]` instantly |
| Delete/rename workout | `useWorkouts.ts:165,309` | list updates instantly |
| Attach workout to daily | `useWorkouts.ts:355` | flip in cache |
| Create community | `useCommunities.ts:359` | keep button spinner (navigates to new id — needs server row) |

### Explicit non-goals (keep server-wait by design)
Onboarding submits (birthday/create-profile/home-gym/privacy), auth/email codes, account
deactivate/delete/export, report submission, admin moderation resolve, daily-post publish upload
(real upload latency — revisit a temp feed row post-launch), avatar/community photo uploads.

**Phase C acceptance:** every P1 interaction reflects in UI < 1 frame after tap on airplane mode
(then rolls back with a toast when the request fails); no button in P1 shows a spinner.

---

## Sequencing, size, risk

| Phase | Files touched (approx) | Risk | Notes |
|---|---|---|---|
| A1-A2 persistence | 5 | Medium | cross-account leak guard is the critical test |
| A3 images | ~14 | Low | mechanical sweep |
| B skeletons | ~35 + 1 lib | Low | pure presentational |
| C-P1 | ~12 hooks | Medium | per-hook rollback tests |
| C-P2 | ~8 | Low-Med | the two "drop invalidate" changes need feed/story regression checks |
| C-P3 | ~5 | Low | after confirms |

QA matrix per phase: cold install · warm revisit · relaunch · airplane-mode relaunch · airplane-mode
taps (rollback) · logout → login as a different account · iPad (review device!) · Expo Go + dev build.
