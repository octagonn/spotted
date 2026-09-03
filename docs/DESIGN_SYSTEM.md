# Spotted Design System (V2)

Last updated: 2026-08-28 (Phase 3 — profile)

This document describes the **actual** Spotted UI system as implemented in `theme/*` and `components/ui/*`.
It is the source of truth for the V2 redesign. `design/*.html`, `design/REDESIGN-SPEC.md` and the other
`design/*` files are historical references only.

Rule for editing this file: do not write a rule the code does not follow. When a decision is made during a
screen phase, update the code, then this file, then `docs/UI_REDESIGN_STATUS.md`.

---

## 1. Source of truth hierarchy

```
theme/palette.json        raw values: colors, status colors, radius, space   ← ONLY place a hex/radius/space is defined
  ├─ theme/colors.ts      typed re-export of palette.colors
  ├─ theme/tokens.ts      semantic tokens (bg / border / text / accent / status), radius, space, typeScale, icon
  └─ tailwind.config.js   derives colors (kebab-cased), rounded-sm/md/lg/pill from the same JSON
theme/typography.ts       className text variants used by components/ui/Text
theme/motion.ts           easings, durations, spring presets
```

`tests/theme.test.ts` fails the build if Tailwind drifts from the palette, if a semantic token points at a
non-palette value, or if spacing leaves the 4pt grid.

Deleted in Phase 0 (zero importers): `theme/spacing.ts`, `theme/tailwind.config.js`.

## 2. Palette

Monochrome ramp + one accent. Never add a feature-specific color to the palette.

| name                            | hex                  | typical use                                                      |
| ------------------------------- | -------------------- | ---------------------------------------------------------------- |
| black                           | #000000              | app background                                                   |
| ink                             | #0A0A0A              | `tokens.bg.base`                                                 |
| graphite                        | #131315              | sheet body, pressed row (legacy card color — being consolidated) |
| charcoal                        | #1C1C1F              | `tokens.bg.raised` — cards, empty states                         |
| iron                            | #27272A              | `tokens.bg.subtle`, `tokens.border.default`                      |
| slate                           | #3F3F46              | `tokens.border.strong`, sheet grip                               |
| ash                             | #52525B              | disabled text on solid buttons                                   |
| fog                             | #909099              | `tokens.text.tertiary` — dimmest text allowed (WCAG AA 4.5:1)    |
| silver                          | #A1A1AA              | `tokens.text.secondary`                                          |
| mist                            | #D4D4D8              | icon default on chrome                                           |
| bone                            | #E4E4E7              | body text in NativeWind variants                                 |
| white                           | #FAFAFA              | `tokens.text.primary`, solid button bg                           |
| pure                            | #FFFFFF              | rare — pure white on media                                       |
| gold                            | #E8B44C              | `tokens.accent.gold` — THE brand accent                          |
| goldSoft / goldSubtle           | gold @18% / @15%     | tinted backgrounds behind gold                                   |
| glass / glassStrong / glassSoft | white @6% / 10% / 4% | translucent overlays on media                                    |
| hairline / hairlineStrong       | white @8% / 14%      | `tokens.border.subtle`, dividers on media                        |

Status (not brand): `tokens.status.danger` #EF4444, `tokens.status.success` #22C55E, `tokens.status.like` #FF2D55 (liked heart — universal convention).
Media scrim: `tokens.bg.scrim` (black @60%) behind controls that sit on photos/video.

### Known drift still in code (to normalize during screen phases)

- Reds: `#E5484D` (settings), `#FF5C5C` (`wtheme.danger`), `#FF3B30` (tab unread dot) → `tokens.status.danger`.
- Like-heart `#FF2D55` in story.tsx / LikersSheet → `tokens.status.like` (PostCard done).
- Cardio orange `#FF8A4C` (`my-workouts`, `workout/[id]`, `WorkoutSlideCard`) → normalize into the mono/gold system in Phase 5/6 unless a lift-vs-cardio distinction proves necessary.
- Other golds: `#FFD76A` (Confetti), `#F2C25A`/`#D89A2E` (LockOverlay gradient), `#9A8A5A` → gold or goldSubtle.
- Hardcoded `#E8B44C` ×6 (onboarding/privacy, PhotoEditor) → `tokens.accent.gold`.

## 3. Gold usage

Gold marks **achievement and important active state**: PRs, streak milestones, first-day marker, the
locked-feed "post to unlock" treatment, a selected trophy. It is not a generic highlight, not a button
color, not a link color. If more than one gold element is visible in a viewport, one of them is wrong.

## 4. Surfaces

Prefer, in order: spacing → typography → contrast → a divider (`Hairline`) → a surface change. Only then a card.

- Screen background: `colors.black` (`Screen` wrapper, tab scenes).
- Raised: `tokens.bg.raised` (charcoal). One level of card. No card inside card.
- Subtle wells / skeletons / placeholders: `tokens.bg.subtle` (iron).
- Sheets: graphite body, 1px iron top border, 20px top radius (see §10).
- Glass: `components/workout/GlassSurface.tsx` is the only frosted container (Liquid Glass on iOS 26, BlurView fallback). Use for floating controls over media only.
- Grain: `GrainOverlay` is global and subtle. Do not increase it.

## 5. Typography

Fonts loaded in `app/_layout.tsx`: Boldonse 400, Anton 400, Geist 400/500/600/700, Geist Mono 400/500. No other family.

| family                    | use                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Boldonse (`font-display`) | SPOTTED wordmark, rare display moments (auth hero, milestone number). Never inline titles — it clips at tight line heights. |
| Geist (`font-sans*`)      | everything else: body, buttons, nav, labels, comments, messages                                                             |
| Geist Mono (`font-mono*`) | deliberate stats: timers, PR values, set numbers, counters, `SectionLabel`                                                  |

Variants (`theme/typography.ts`, consumed via `components/ui/Text`; className-based, color overridable with
`className="text-fog"` etc. — do not override size/leading via className):

| variant                          | spec                         | use                                       |
| -------------------------------- | ---------------------------- | ----------------------------------------- |
| `display-xl/lg/md/sm`, `title`   | Boldonse                     | hero/display moments only                 |
| `body-xl`, `body`, `body-strong` | Geist 22 / 17 / 17-600       | long-form screens, settings, onboarding   |
| `caption`                        | Geist 13 silver              | helper text                               |
| `micro`                          | Geist 11-500 uppercase fog   | section eyebrows                          |
| `button`                         | Geist 15-600 black           | button labels                             |
| `username`                       | Geist 15-600 white           | handles, interactive names                |
| `body-sm` / `body-sm-strong`     | Geist 15 bone / 15-600 white | captions, comments, rows                  |
| `meta` / `meta-strong`           | Geist 13 fog / 13-500 silver | timestamps, counts, locations, song lines |
| `label`                          | Geist 12-500 silver          | chips, badges, story names                |
| `mono`                           | Geist Mono 12 fog            | stats, section labels                     |

`theme/tokens.ts` `typeScale` is **deprecated** — the same scale as the feed variants above; it remains only under
`MusicChip` and `LikedByLine` until those migrate. Do not write `fontFamily: "Geist_…"` inline in a screen; the
one sanctioned exception is the Boldonse SPOTTED wordmark (`FeedHeader`), which needs a custom line box.

## 6. Spacing

4pt rhythm: `space[1..12]` = 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 (`theme/tokens.ts`; Tailwind `p-1…p-12` match).
Standard screen gutter: **16**. Section gap: **24**. Content-to-tab-bar clearance: `pb-32` via `Screen`.
Avoid 13/17/19/23/27/30 unless mathematically derived (centering, hairline compensation).

## 7. Radius

`radius.sm` 12 (chips, inputs, small buttons) · `radius.md` 16 (cards, cells, buttons) · `radius.lg` 24 (large containers, segmented) · `radius.pill` 999 (circles/capsules only).
Tailwind: `rounded-sm / md / lg / pill`. Legacy `rounded-spotted` (18) / `rounded-card` (22) / `rounded-sheet` (28) remain for ~16 call sites and are removed as screens are redesigned.

## 8. Icons

Lucide only (`lucide-react-native`). Sizes from `icon.size` in `theme/tokens.ts`:

| token | px  | role                                     |
| ----- | --- | ---------------------------------------- |
| xs    | 16  | inline metadata, chip glyphs             |
| sm    | 20  | compact controls in rows/inputs          |
| md    | 24  | standard actions (header, list trailing) |
| lg    | 28  | primary navigation                       |

Stroke: `icon.stroke.thin` 1.75 (≤16px), `regular` 2 (default), `bold` 2.25 (selected nav).
Current code uses 20+ sizes and 12 stroke widths; snap during each screen phase. Do not install `expo-symbols`.

## 9. Interaction primitives

- `Pressable` (`components/ui/Pressable.tsx`): core RN Pressable + scale 0.965 / opacity 0.85, a11y role + hitSlop defaults. **Never wrap in Reanimated** (broke NativeWind className on device).
  - `haptic` prop is semantic: `"none" | "selection" | "impact" | "success" | "warning"` (booleans are legacy). Default is still `true`→selection until every screen sets explicit kinds; then it flips to `"none"`.
- `Button`: `solid` (white/black) and `ghost` (slate border). `primary`/`danger` are aliases (danger currently renders as ghost — fix in the Settings phase). `RelButton` for relationship pills.
- Touch targets: ≥44pt practical (hitSlop counts).

## 10. Sheets and modals

- One system: `SheetProvider` + `useSheet().open(<Content/>)` (`components/ui/Sheet.tsx`, Gorhom v5). Dynamic sizing, max 78% height, keyboard interactive, `durations.sheet` + `easing.emphasized`. Titles via `SheetTitle` / `SheetSub`. Inputs inside sheets use `SheetTextInput`.
- Native `<Modal>` is acceptable only for full-screen or system-like dialogs (`AppDialog`, legal, celebrations). 16 files still use raw `<Modal>` for panel-style content and 7 hand-build the 36×4 grip — migrate to `useSheet` during their screen phase.
- Alerts: `appAlert()` from `AppDialog`, never `Alert.alert`.

## 11. Rows, lists, inputs

- `UserRow` (44pt avatar, 56pt `big`) is the ONE way to show a person in a list; `ListRow` is its base (any leading slot). `ChoiceRow` for selectable sheet rows. `SettingRow / SettingToggle / SettingNavRow (icon, danger) / SettingChoice (2–3 inline pills) / SettingSectionLabel` for settings-style screens. `OptRow`, `MenuRow` are single-use presets slated for consolidation.
- `TextField` is the boxed input (raised fill, no border, radius 12, 46pt; `left`/`right` adornments, `hint`, `counter`). `SheetTextInput` stays for gorhom sheets (style it like `TextField`). `components/auth/AuthField` / `PasswordField` are the translucent glass inputs for the video-backed auth flow only.
- `SearchBar` is the search input. `components/map/GymSearchBar.tsx` is a parallel implementation to fold in.
- `Segmented` is the segmented control: `solid` (44pt, white thumb — primary) or `variant="quiet"` (36pt, glass thumb — secondary filters like the feed's Friends/Public). `SectionLabel` (mono uppercase) + `Hairline` for section structure.
- Lists >~30 items or with media: FlashList 2 with stable `keyExtractor`, `recyclingKey` on images, stable `renderItem`.

## 12. Avatars and media

- `Avatar` (sizes 32/40/56/96 or number; circle/square; deterministic gradient fallback). `GroupAvatar`, `LiveRing`.
- Row avatar size is inconsistent today (44/46/48/58) — standard is **44** in rows, **40** compact, **56** in headers.
- Images go through `CachedImage` (expo-image, memory-disk cache, 140ms fade, resolves `r2:` refs). Pass `recyclingKey` in FlashList.
- Post media: `PostMedia` inside `MediaFrame` (pinch/zoom/double-tap). Signed URLs only — private `posts` bucket.

## 13. Loading, skeletons, empty states

- `Skeleton` + presets (`SkeletonRows`, `PostCardSkeleton`, …) for initial loads; `ActivityIndicator` only inside buttons/footers.
- `EmptyState` (`icon, title, body, tone: default|gold`) for every empty list. ~22 ad-hoc empties remain in `app/` — replace during screen phases.
- No oversized illustrations, no explanatory paragraphs.

## 14. Motion

`theme/motion.ts`:

- Easings: `easing.standard` (presses), `easing.emphasized` (screens/sheets), `easing.exit`.
- Durations: `press 140`, `color 180`, `toast 220`, `backdrop 240`, `tab 280`, `panel 300`, `sheet 320`, `camera 340`.
- Springs: `springs.snappy` (press/selection), `springs.gentle` (panels/cards), `springs.bouncy` (celebrations only).
- Animate `transform` + `opacity` on the UI thread (Reanimated 4 / worklets). Avoid `LayoutAnimation` (11 uses today) and continuous layout animation.
- Honor `useReducedMotion()`.
- Motion communicates state, hierarchy, continuity, completion — not capability.

## 15. Haptics

Semantic, not decorative (`lib/haptics.ts` → `haptic(kind)`). `selection` for tabs/segments/chips/toggles; `impact` for logging a set, sending, capturing; `success` for post published / PR / milestone; `warning` before destructive confirms. Everything else `none`. Import from `@/lib/haptics`, never `expo-haptics` directly (6 bypasses remain).

## 16. Navigation and screen layout

- Tabs: Home · Friends · **Camera (action, pushes `/camera`)** · Map · Profile — `app/(tabs)/_layout.tsx` is a Material Top Tabs navigator over `react-native-pager-view` (bar at the bottom) so pages track the finger. Camera is not a destination. No hidden/redirect routes inside `(tabs)`.
- Pushed screens: full-screen swipe-back (`fullScreenGestureEnabled`) everywhere; slide-up screens dismiss vertically.
- Headers: `PanelHeader` (sticky, safe-area-aware, 34px back circle, `right` slot) is the header. `BackButton` is the standalone circle for headerless screens. 9 screens still hand-roll headers.
- Screen wrapper: `components/Screen.tsx` (safe-area top, black bg, `px-4 pb-32` when scrolling).
- Safe areas via `react-native-safe-area-context`; content must clear the floating tab bar.

## 17. Accessibility

Dynamic Type never disabled; display text capped at ×1.4. Every pressable has a role and label (Pressable defaults; icon-only buttons must pass `accessibilityLabel`). Text ≥ fog on dark. Reduce-motion respected in loops/pulses. Sheets expose a labeled backdrop "Close".

## 18. Home feed composition (Phase 2)

`FeedHeader` (mark · wordmark · bell) → optional offline pill → `StoriesRail` (Friends tab) → `Segmented quiet`
→ `PendingPostsStrip` → posts. A post is `PostCard` = `PostHeader` → `MusicChip` → media (`MediaFrame` +
`PostMedia`, hero) → `PostActions` → `LikedByLine` → `PostCaption`. 32pt of base background between posts, no
hairlines, no card containers. Stories: 64pt avatars, 2pt ring (white = unseen, slate = seen), gold only on the
add badge. Action icons `icon.size.md`; the like heart is `status.like`; the live-reaction capture ring is the
one Spotted-specific control and stays dashed.

## 19. Profile composition (Phase 3)

Both profiles are built ONLY from `components/profile/*` sections, in this order: top bar (own: handle +
visibility · add story · settings; other: `PanelHeader`) → `ProfileIdentity` (avatar w/ story ring, posts/friends
`Stat`s, name `subheading`, bio `body-sm`, gym `meta`, socials) → action buttons (`Button ghost` ×2 own; relationship
row other) → `ProfileStatsRow` (streak · longest · trophies; gold only on the live flame) → `FeaturedTrophies` chips →
`SettingNavRow`s (My Workouts, Trophies) → `StreakCalendarSection` (the one raised card; `bg.raised`, `radius.md`,
no border) → `ProfileContentTabs` (`micro` labels, 2pt underline) → `ProfileMediaGrid` / `WeeklySplit`. Section
gap is 16; gutter is `PROFILE_GUTTER` (16). No gold-tinted cards, no outline buttons for navigation.

## 20. Screen-specific exceptions (ratified)

- **Auth / onboarding** (`app/(auth)`, `app/(onboarding)`): Boldonse `display-md` titles, glass pills/inputs over the looping video, no `PanelHeader`. Shared via `components/auth/{OnboardingHeader,AuthField}`.
- **Story viewer** chrome over media: progress track `rgba(255,255,255,0.3)`, reply-field border `rgba(255,255,255,0.4)`.
- **Camera** chrome over live video: `rgba(0,0,0,0.55)` circles; capture/record/dual/zoom body untouched.
- **Data-driven colors → raw `Text`** (the only sanctioned raw `Text` usages): `communities/Badges.PillBadge` (role colors), `trophies/TrophyCard.EarnedLine` + the unlock modal eyebrow (medal tints), the role name in `community/[id]/roles.tsx`.
- **Effect / data palettes stay literal**: `Avatar` + `profile/media` initial gradients, `PhotoEditor` pen colors + hue wheel, `DiamondGlint`, `Confetti`, `MapCanvas.native` GL HTML, aurora backgrounds, `trophyMedal` bronze/silver/diamond.
- **Raw RN `Modal`** is still used where a surface must layer above the sheet host or render on web: `TrophyDetailSheet`, `TrophyUnlockModal`, `JoinGymCommunityPrompt`, the iOS time picker in notification settings.

## 21. Buttons and destructive actions

- `Button` variants: `solid` (default), `ghost`, `danger` (outlined in `status.danger`), `danger-solid` (filled — at most one per screen, for the irreversible action). `primary` is a legacy alias of `solid`; the old `danger→ghost` alias is gone.
- `RelButton` kinds: `primary` (white pill), `ghost` (white text, slate border — available secondary action), `quiet` (fog text — done/inert state).
- `IconButton` (44pt default; `variant="ghost"` ringed / `"plain"`) for header and row icon actions; never a bare `Pressable` around a Lucide glyph.
- Destructive rows use `SettingNavRow danger`; destructive menu items use `MenuRow destructive` — both read `tokens.status.danger`.

## 22. Domain component index (V2)

| Domain | Components |
| --- | --- |
| post | `PostCard`, `PostHeader`, `PostActions`, `PostCaption`, `FeedHeader`, `StoriesRail`, `PostCardSkeleton` |
| profile | `ProfileIdentity` (`PROFILE_GUTTER`), `ProfileStatsRow`, `FeaturedTrophies`, `StreakCalendarSection`, `ProfileContentTabs`, `ProfileMediaGrid` |
| workout | `WorkoutHeader`, `WorkoutLiveSummary`, `WorkoutEmptyState`, `WorkoutFinishSummary`, `PrCelebration`, `ExerciseCard`, `RestTimerPill`, `PrBadge`, `ExerciseIcon`, `WorkoutHistoryCard`, `InProgressCard` |
| friends | `MessagesTab`, `FriendsListTab`, `FindFriendsTab`, `SwipeableThreadRow`, `ChatBubbles`, `PresenceLine`, `NewGroupSheet`, `PickFriendSheet` |
| chat | `ChatHeader`, `ChatComposer` (also the community chat composer), `MessageMedia` (`AudioBubble`, `VideoBubble`, `ShareCard`, `ViewOnceBubble`, viewers) |
| notifications | `NotificationRow`, `SystemNoticeRow` (+ `lib/notificationCopy`) |
| map | `GymRow`, `GymSearchBar`, `GymPreviewSheet`, `MapCanvas(.native)` |
| camera | `ComposeChrome`, `MediaPreview`, `GymSheet`, `FriendsSheet`, `CommunitySheet`, `MusicSheet`, `types` |
| story | `StoryOverlay`, `StoryHeader`, `StoryChips`, `StoryBars`, `StoryViewersList` |
| communities | `CommunitiesHub`, `CommunityHeroCard`, `CommunityRow`, `CommunityTile`, `CommunityHeader`, `CommunityBoard`, `CommunityChatList`, `CommunityFeedGrid`, `MemberRow` / `JoinRequestRow`, `LeaderboardRow`, `Badges` (`PillBadge`, `TenureChip`, `MemberCheck`), `RoleChip`, `LockedCommunitySheet`, `InviteFriendsSheet`, `InviteCodeSheet`, `JoinGymCommunityPrompt` |
| trophies | `TrophyCard` (`TrophyCard`, `EarnedTrophyCard`, `TrophyIconDisc`), `TrophyCase`, `TrophyCategorySection`, `TrophyDetailSheet`, `TrophyUnlockModal`, `TrophyShareCard`, `TrophyTierLadder/Row`, `TrophyProgressBar`, `TrophyRarity` |
| auth | `OnboardingHeader` (`StepPill`, `ONBOARDING_STEPS`), `AuthField` / `PasswordField` / `PasswordRequirements` |
| settings | `ModeratedAccountsScreen` |

