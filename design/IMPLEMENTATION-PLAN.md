# Redesign implementation plan (UI phase)

Read `design/REDESIGN-SPEC.md` first — it is the single source of truth for visuals/copy.
`docs/UI-FUNCTION-MAP.md` tracks every interactive element; update its `status` column as you wire things.

## Phase rule
This is the **UI phase**: screens must look and behave exactly like the spec. Wire existing
backend hooks where they already exist (feed, friends, messages, profiles, gyms, checkins,
streaks, comments via `post_comments`); everything with no backend (communities, follow,
trophies, weekly challenge, live presence strip, selfie reactions, daily-lock state) runs on
typed mock data from `lib/redesignData.ts` + local zustand state so the full UX is clickable.
Backend wiring is a later phase — do NOT invent new Supabase tables now.

## Routing map (Expo Router)
- `app/(tabs)/feed.tsx` — HOME feed (spec §4)
- `app/(tabs)/friends.tsx` — FRIENDS (spec §5)
- `app/(tabs)/map.tsx` — MAP/Communities (spec §7)
- `app/(tabs)/profile.tsx` — PROFILE (spec §8)
- `app/(tabs)/_layout.tsx` — custom 5-slot tab bar (spec §3). Camera slot is NOT a tab route:
  it pushes `/camera`. Remove `app/(tabs)/camera.tsx` + `explore.tsx`/`index.tsx` redirects stay.
- `app/camera.tsx` — full-screen modal, slide-up (spec §6, both flows + compose + preview)
- Panels (stack screens, slide-from-right):
  - `app/user/[username].tsx` (spec §9)
  - `app/chat/[id].tsx` (spec §5.2)
  - `app/community/[id].tsx` (spec §7.2)
  - `app/profile-section/[section].tsx` — stats | trophies | videos | posts (spec §8.2–8.6)
  - `app/trophy/[id].tsx`, `app/achievement/[id].tsx`, `app/daily/[date].tsx`
- Old modals `app/streak.tsx`, `app/paywall.tsx`, `app/post/[id].tsx`, `app/settings/*` — KEEP
  routes working (do not delete; they're off the main nav for now). Do not restyle them in this phase.

## Shared foundation (built first — everyone else imports these)
- `theme/motion.ts` — easing curves + durations from spec §1.3/§10
- `components/ui/` rewritten primitives: `Avatar` (circle default, initial+gradient fallback,
  sizes, group variant), `Button` (solid/ghost/relationship pill), `Segmented`, `SectionLabel`,
  `ListRow`, `PanelHeader`, `SheetHost` (single bottom-sheet host, spec §2.7),
  `Toast` (global store + host), `Chips` (type-pill, today-pill, ctx, vchip, lift-tag, vid-dur,
  live-badge, play-badge), `ChoiceRow`, `OptRow`, `Flash`.
- `stores/ui.ts` — toast queue, sheet control, posted-today flag (persisted date key, resets at
  local midnight), reaction/spot local state.
- `types/redesign.ts` + `lib/redesignData.ts` — Community, Trophy, Achievement, LiveFriend,
  WeeklyChallenge, RelationshipState + mock fixtures matching spec copy exactly.
- Fonts in `app/_layout.tsx`: add Geist 700, Geist Mono 400/500 (`@expo-google-fonts/geist-mono`),
  Anton (`@expo-google-fonts/anton`). Tailwind: add `font-mono` family + any missing tokens.

## Conventions
- px values from spec = dp 1:1. Global gutter 18px (sheets 20px).
- Every pressable: scale 0.965 + opacity 0.85, 140ms (use the shared `Pressable`).
- Strictly monochrome — no accent colors anywhere (remove the orange flame usage in new UI).
- Reanimated for pulses/transitions; gate infinite pulses behind reduce-motion.
- Keep typecheck/lint/tests green; web bundle must still build (native-only modules behind
  `.native.tsx` splits with web stubs, as the codebase already does).

## File ownership (parallel agents)
- FOUNDATION: everything under "Shared foundation" + tab bar + font loading.
- HOME: `app/(tabs)/feed.tsx`, `components/post/*` (post card, media kinds, reactions,
  comments, live strip, lock overlay, spot sheet, reaction-capture sheet).
- FRIENDS: `app/(tabs)/friends.tsx`, `app/chat/[id].tsx`, find-friends components.
- MAP: `app/(tabs)/map.tsx`, `app/community/[id].tsx`, gym preview sheet, challenge card/sheet.
- PROFILE: `app/(tabs)/profile.tsx`, `app/user/[username].tsx`, `app/profile-section/[section].tsx`,
  `app/trophy/[id].tsx`, `app/achievement/[id].tsx`, `app/daily/[date].tsx`, friends/following sheets.
- CAMERA: `app/camera.tsx` + `components/camera/*` (capture steps, compose, option sheets, preview).
