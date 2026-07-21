# SPOTTED — Redesign Spec (canonical, from `design/redesign.html`)

> Implementation-ready spec for the Spotted React Native app (Expo + NativeWind).
> Source of truth: `design/redesign.html` (interactive HTML prototype). This doc captures 100% of its screens, states, styles and copy so implementers never need to open the HTML.
>
> All colors are given as **token names** (see §1). All sizes are px from the mockup (393×852 device frame); use them 1:1 as dp in RN.

---

## 0. App structure at a glance

- **4 tab screens** in a screen stack: `home` (feed), `friends`, `map`, `profile`. Cross-fade + micro-zoom transition between tabs.
- **Panels**: right-slide pushed pages layered above tabs (other-user profile, conversation, community page, trophy detail, achievement detail, daily post detail, profile sections Stats/Trophies/Videos/Posts). Panels stack (push/pop). Switching tabs clears the whole panel stack.
- **Camera**: full-screen layer that slides up from the bottom over everything (z above panels). Two modes: `daily` (front+back photo) and `lift` (max-lift video).
- **Bottom sheets**: single sheet host + dimmed backdrop, used for: spot-me sheet, reaction capture, mutual friends, gym picker, tag friends, music, communities picker, gym preview, weekly challenge, friends list, following list.
- **Toast**: white pill, bottom-center above the nav.
- **Flash**: full-screen white flash for camera captures.
- Screens NOT in the mockup (do not invent): onboarding, settings, paywall/IAP, stories viewer, notifications. Feed "lock" replaces the paywall concept on home.

### Mockup-only device chrome — SKIP in RN
- Desktop "stage" wrapper (`.stage`, `.stage-header`, brand "SPOTTED / Interactive prototype · live presence · challenges"), the phone bezel (`.device`, 393×852, radius 56, gradient shell), the Dynamic-Island cutout (`.device-island`) — **SKIP**.
- Fake iOS status bar (`.status-bar`, "9:41", signal/wifi/battery SVGs, height token `--status-h: 54px`) — **SKIP**; RN uses the real status bar / safe-area insets. Anywhere the spec says "below status bar" use `insets.top`.
- The global film-grain overlays (`body::before` and `.device-screen::after`: SVG feTurbulence noise, opacity 0.03/0.025, `mix-blend-mode: overlay`, z on top of everything, pointer-events none) — this IS a design feature, not chrome. The app already has `GrainOverlay`; keep it at this subtle level.
- The mockup's simulated photos (`.ph` scene gradients `s1–s6` + black silhouette SVGs `SIL.*`) are placeholders for real camera media — **SKIP**, but note every `.ph` carries: an inner noise overlay (feTurbulence, alpha 0.08, overlay blend) and a legibility gradient `linear-gradient(180deg, rgba(0,0,0,0.12), transparent 30%, transparent 62%, rgba(0,0,0,0.4))`. Apply that gradient overlay on real photos in posts.

---

## 1. Design tokens

### 1.1 Colors — `:root` (all already exist in `tailwind.config.js`)
```
--black:    #000000
--ink:      #0A0A0A
--graphite: #131315
--charcoal: #1C1C1F
--iron:     #27272A
--slate:    #3F3F46
--ash:      #52525B
--fog:      #71717A
--silver:   #A1A1AA
--mist:     #D4D4D8
--bone:     #E4E4E7
--white:    #FAFAFA
--pure:     #FFFFFF
```
The design is **strictly monochrome** — there is no accent color anywhere in the mockup (no orange flame, no brand color). "Active/selected" is always white-on-black inversion.

Common alpha colors used inline (add as tokens or use arbitrary values):
- `rgba(0,0,0,0.5 / 0.55 / 0.6 / 0.62 / 0.65 / 0.7 / 0.72)` — scrims and chip backgrounds on media
- `rgba(255,255,255,0.035)` — here-row fill; `rgba(255,255,255,0.05)` — camera grid lines; `rgba(255,255,255,0.1)` — inner highlight; `rgba(255,255,255,0.18)` — map self pulse ring; `rgba(255,255,255,0.25/0.4/0.5)` — pulse shadows

### 1.2 Typography
- `--font-display: 'Boldonse', 'Anton', sans-serif` — display font. **Anton is NEW** (existing app loads only Boldonse + Geist); load `Anton_400Regular` from `@expo-google-fonts/anton` as the display fallback (RN has no font fallback chains — pick Boldonse as primary; Anton is used by the mockup only as fallback, so shipping Boldonse alone is acceptable, but the spec calls for Anton to be available).
- `--font-body: 'Geist'` weights 400/500/600/700 — body font (exists; **Geist 700 is new**, app currently loads 400/500/600).
- `--font-mono: 'Geist Mono'` weights 400/500 — **NEW to the app** (no mono font loaded today). Used pervasively: timestamps, section labels, chips, counters, ranking values, live badges, map labels.

### 1.3 Motion easings
```
--ease-standard:   cubic-bezier(0.32, 0.08, 0.24, 1)   // presses, small UI
--ease-emphasized: cubic-bezier(0.2, 0, 0, 1)          // screen/panel/sheet transitions
--ease-exit:       cubic-bezier(0.4, 0, 1, 1)          // (declared, unused in mockup)
```

### 1.4 Layout tokens
```
--nav-h:   84px   // bottom tab bar height
--status-h: 54px  // mockup status bar — replace with safe-area inset
--r-sheet: 20px   // bottom sheet top corner radius
```
Screen scroll containers pad: top `status-h` (→ inset), bottom `nav-h + 12px`. Global horizontal content gutter is **18px** (sheets use 20px).

### 1.5 Global element behaviors
- `.pressable`: press feedback = `scale(0.965)` + `opacity 0.85`, 140ms `ease-standard`. Apply to every tappable element.
- Body text is `--bone` on `--black` by default; antialiased.

---

## 2. Shared primitives

### 2.1 Avatars (`.av`)
- **Circle by default**; `.av.sq` variant = 10px radius square (declared but unused in mockup — everything rendered is circular).
- Content: single **initial letter**, weight 700, color `mist`, font-size = `round(size × 0.4)`.
- 1px border `iron`; gradient sheen overlay: `linear-gradient(160deg, rgba(255,255,255,0.10), transparent 55%)`.
- 8 background gradients (`140deg`): `g1 #3F3F46→#18181B`, `g2 #52525B→#27272A`, `g3 #2E2E33→#0F0F11`, `g4 #47474E→#1C1C1F`, `g5 #5A5A63→#2E2E33`, `g6 #39393F→#121214`, `g7 #6B6B74→#3F3F46`, `g8 #26262B→#0A0A0A`. (For real users, replace with profile photos; keep initial+gradient as fallback.)
- Sizes used: 24, 26, 28, 30, 32, 34, 40, 42, 46, 66, 72.
- **Group avatar** (`.group-av`): 46×46 container, two 30px avatars overlapped diagonally (first top-left, second bottom-right), each with 2px `black` border.

### 2.2 Buttons
- **`.btn-solid`** (primary): bg `white`, text `black`, weight 700, size 14, letter-spacing 0.01em, radius 12, padding 14px 20px, full-width flex row centered, gap 8. Active: scale 0.98 + opacity 0.85 (140ms standard). Disabled: bg `iron`, text `ash`.
- **`.btn-ghost`** (secondary): 1px border `slate`, text `bone`, weight 600, size 14, radius 12, padding 13px 20px, transparent bg.
- **`.rel-btn`** (relationship pill): size 12, weight 700, ls 0.02em, padding 7px 16px, radius 8, min-width 78, centered, border 1px `slate`, text `bone`; transition all 180ms standard.
  - `.primary`: bg `white`, text `black`, border `white` — used for "Add" / "Add Back".
  - `.quiet`: text `fog`, border `iron` — used for "Friends ✓" / "Following" / "Added".
- **`.lock-cta`**: white pill (radius 999), text black 700 / 13.5px, padding 12px 26px, icon+label gap 8.
- **`.rank-cat`** filter chip: size 12 weight 600, `fog` text, 1px `iron` border, radius 999, padding 7px 14px. On: black text on `white` bg, white border.
- **`.lift-cat`** underline chip (declared; rankings actually use rank-cat chips): mono 10.5px uppercase ls 0.1em, `fog`, 1.5px bottom border transparent → white when on.

### 2.3 Segmented control (`.seg`)
- Container: margin 10px 18px 14px, 1px border `iron`, radius 10, padding 3px, bg `graphite`.
- Buttons: flex 1, padding 8px 0, size 13, weight 600, ls 0.01em, color `fog`, radius 7. Active (`on`): black text on `white` bg. Transition color/background 180ms standard.
- Used on: Home (Friends|Public), Friends (Messages|Find Friends), Map (Communities|Map).

### 2.4 Headers
- **`.app-head`**: row space-between, padding 8px 18px 4px.
  - `.app-brand` "SPOTTED" (home only): display font, 19px, `white`, ls 0.01em, line-height 1.4.
  - `.app-head-title` (Friends/Communities/Map/Profile): weight 700, 22px, ls −0.02em, `white`.
- **`.panel-head`** (pushed pages): row, gap 12, padding 10px 16px 12px, sticky top, bg `linear-gradient(180deg, black 78%, transparent)`.
  - `.panel-back`: 34×34 circle, 1px border `iron`, chevron-left icon, color `mist`.
  - `.panel-title`: 600 / 16px / `white` / ls −0.01em. `.panel-sub`: 12px `fog`, margin-top 1px.

### 2.5 List row (`.row`)
- Row, gap 12, padding 11px 18px. Pressable variant (`.row-press`): active bg `graphite` (150ms).
- `.row-name`: 600 / 14.5px / `bone` / ls −0.01em. `.row-sub`: 12.5px `fog`, margin-top 2, single-line ellipsis. `.row-time`: mono 10.5px `ash`.
- Unread dot (`.dot`): 8px circle `white`.

### 2.6 Section label (`.section-label`)
Mono, 10.5px, ls 0.12em, UPPERCASE, `fog`, padding 18px 18px 10px.
`.hairline`: 1px `iron`, margin 0 18px.

### 2.7 Bottom sheet (`.sheet`)
- Anchored bottom, bg `graphite`, top border 1px `iron`, radius `20px 20px 0 0`, max-height 78% (scrollable), padding-bottom 28 (+ bottom inset).
- Handle: 36×4 `slate`, radius 2, margin `10px auto 4px`.
- Backdrop: `rgba(0,0,0,0.62)`, fade 240ms standard.
- Enter/exit: translateY 105% → 0, 320ms emphasized.
- `.sheet-title`: 700 / 16px / `white`, padding 10px 20px 2px, ls −0.01em. `.sheet-sub`: 12.5px `fog`, padding 2px 20px 8px.

### 2.8 Choice row (inside sheets, `.choice-row`)
Row gap 12, padding 13px 20px; active bg `charcoal`; `.disabled`: opacity 0.38 + no pointer events.
- `.choice-name` 600/14.5 `bone`; `.choice-sub` 12px `fog` mt 2.
- `.check-ring`: 22px circle, 1.5px border `slate`; ON = bg+border `white` with black 11px check icon; 160ms standard.

### 2.9 Option row (compose screen, `.opt-row`)
Row gap 12, padding 13px 18px; active bg `graphite`.
- `.opt-icon`: 36×36, radius 10, 1px border `iron`, icon `silver`.
- `.opt-label`: flex 1, 600/14 `bone`. `.opt-value`: 12.5px `fog`, right-aligned, max-width 150, ellipsis; `.set` state = `white` 600. Trailing chevron-right.

### 2.10 Toast (`.toast`)
White pill bottom-center at `nav-h + 22px`; text black 600 / 13px; padding 10px 18px; radius 999. In: fade+rise 16px, 220ms standard; auto-hides after 2100ms.

### 2.11 Badges & chips
- `.type-pill` (community type): mono 9.5px uppercase ls 0.1em `silver`, 1px `iron` border, radius 5, padding 2px 6px, inline after name.
- `.today-pill` ("N today"): mono 9px 700, black on `white`, radius 999, padding 3px 8px.
- `.ctx` (public-feed context chip): row gap 5, mono 10px ls 0.05em `silver`, 1px `iron` border, padding 4px 9px, radius 999. Row: `.ctx-row` gap 6, padding 10px 18px 0, wraps.
- `.vchip` (video chip): mono 9px 700 uppercase ls 0.16em, `mist` on `rgba(0,0,0,0.7)` + 1px `slate` border, padding 4px 9px, radius 999. `.hot` (PR): black on `white`.
- `.lift-tag`: row gap 6, mono 10.5px uppercase ls 0.1em `white`, bg `rgba(0,0,0,0.72)` + 1px `slate` border, padding 6px 10px, radius 8; positioned top-left 12px on media.
- `.vid-dur`: mono 10.5px `white` on `rgba(0,0,0,0.65)`, padding 4px 8px, radius 6, bottom-right 12px.
- `.live-badge` ("LIVE"): mono 8px 700 ls 0.14em, black on `white`, padding 2px 7px, radius 999, hanging −6px below avatar ring.
- `.play-badge`: 56px circle centered on media, bg `rgba(0,0,0,0.55)`, 1.5px `white` border, white play icon. Small variant 28–30px.

### 2.12 Icons
All icons are 24-viewBox stroke SVGs (stroke-width mostly 2–2.2, round caps/joins) — map to `lucide-react-native` equivalents: pin/map-pin, home, dumbbell, check, plus, x, chevron-left (back), chevron-right, send, message-circle (comment), search, music, user-plus (tag), users, trophy, play (filled), refresh-ccw (flip), lock, camera, flame, graduation-cap (school), sun, bar-chart (chart), calendar.
Decorative glyphs used inline as text: `◎` (target/spot mark), `♪`, `👊`, `⌄`, `↔`, `○`, `✓`.

---

## 3. Bottom navigation

Order: **Home · Friends · Camera (center) · Map · Profile**.
- Bar: absolute bottom, height 84 (+bottom inset), row space-around, align to top, padding 12px 18px 0; bg `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.92) 34%, black 100%)` — content scrolls behind it.
- Tabs: 52×44 icon buttons, 24px outline icons, color `ash`; active = `white` (color 180ms). Press: scale 0.9.
- Icons: home (roofline), friends (two-person), map (trifold), profile (person). No labels.
- **Center camera tab** (`.tab-cam`): 64×64 circle raised −12px above the row, 2.5px `white` border, bg `ink`, white 28px camera icon, shadow `0 6px 24px -6px rgba(0,0,0,0.9)` + inner top highlight `inset 0 1px 0 rgba(255,255,255,0.1)`. Press: scale 0.92.
  - **Posted state** (`.posted`, after publishing today's daily): border dims to `slate` and a 14px white dot with 3px black ring appears at top-right (2px, 2px).
- Tapping the active tab again clears any open panels (pop-to-root behavior).

### Screen transitions
- Tab switch: outgoing fades; incoming `opacity 0→1` + `scale(1.015)→1`, 280ms emphasized.
- Panel push: `translateX(100%)→0`, 300ms emphasized; pop reverses (remove after 320ms).
- Camera: `translateY(100%)→0`, 340ms emphasized.

---

## 4. HOME — Feed

### 4.1 Layout (top→bottom)
1. **App head**: brand "SPOTTED" (display 19px) left; nothing right.
2. **Live "Spot me" strip** — *Friends tab only* (§4.5).
3. **Segmented control**: `Friends` | `Public`.
4. **Feed body**: posts list; bottom-bordered (`1px graphite`) articles.
   - Friends tab, unlocked: my published posts first (max-lift post, then daily post), then `FRIEND_POSTS`.
   - Public tab: `PUBLIC_POSTS` with context chips.
5. **Locked state** overlay when the user hasn't posted today (§4.6).

### 4.2 Post card (`.post`)
Padding 14px 0 6px; border-bottom 1px `graphite`.
- **Header row** (padding 0 18px 10px, gap 10):
  - 40px avatar (tap → user profile);
  - username = handle w/o `@` (700/14 `white` ls −0.01em) + location line;
  - right: relative time (mono 10.5 `ash`), e.g. `11m`, `2h`.
- **Location line** (`.post-loc`): 12px `silver`, pin icon, gap 5 — mapped gym name (e.g. "Gold's Gym Chelsea"). Unmapped variant: `fog`, *italic*, home icon, text `"{altLoc} · not a mapped gym"` (e.g. "Home gym · not a mapped gym", "Unlisted location · not a mapped gym").
- **Media** — one of four kinds (§4.3).
- **Context chips row** — public feed only, from post data, e.g. `◉ 0.4 mi · your gym`, `3 mutual friends`, `38 reactions today`, `Rising in Brooklyn`, `1.8 mi away`, `Nearby` (pin/users/flame icons).
- **Caption** (`.post-caption`): 13.5px `mist` lh 1.45, padding 10px 18px 0; leading bold handle in `white` (margin-right 6).
- **Reactions row** (§4.4).
- **Inline comments** (§4.4).

### 4.3 Media kinds
1. **Front-and-back photo (`.fb`)** — default. Full-bleed, aspect `3 / 3.6`. Inset selfie (`.fb-inset`): top-left 12px, width 31%, aspect 3/4, radius 12, 2px `black` border, shadow `0 6px 20px rgba(0,0,0,0.55)`.
2. **Milestone plate (`.plate-card`)** — kinds `pr` / `streak`. Card margin 0 18px, 1px `slate` border, radius 16, bg `linear-gradient(160deg, graphite, ink)`, padding 30px 18px 28px, centered text. Two decorative circles (1px `iron` border): 220px at top −84/right −70; 140px at bottom −64/left −52.
   - Tag (`.plate-tag`): mono 10.5 ls 0.24em uppercase `silver`, mb 14 — copy: `◎ New PR — Bench`, `◎ Streak milestone`.
   - Big number (`.plate-big`): **display font 50px** `white` lh 1.05 — `275`, `30`; unit (`.plate-unit`) 19px `fog` ls 0.08em ml 9 — `LB`, `DAYS`.
3. **Video (`.fb.lift-video`)** — kind `video` (form check / PR). Full-bleed `.fb` w/o inset; top-left chips (`PR` hot + `Form check`), center play badge, bottom-right duration (`0:42`, `0:31`). Tap-to-play: play badge hides, 3px white progress bar animates width 0→100% over 4.1s linear, auto-resets ~4.3s (mock timing; real = video length). Extra scrim on video: `linear-gradient(180deg, rgba(0,0,0,0.3), transparent 35%, rgba(0,0,0,0.55))`.
   - **Max-lift kind `lift`** (own published post): `.fb` with inset + `.lift-tag` `🏆 {lift} · {weight}` + play badge + duration.
4. **Before/after compare (`.cmp`)** — kind `compare`. Aspect `3 / 2.4`; two stacked images, right one clipped `inset(0 0 0 50%)`; labels top: left `JAN` (mono 10 700 ls 0.16em `silver` on `rgba(0,0,0,0.6)`, radius 6), right `JUL` (black on `white`); 2px white divider with 34px white knob (`↔` black 700/14) centered; invisible full-area range input (min 6, max 94) drives clip + divider position live.

### 4.4 Reactions + comments
- **Reactions row** (padding 10px 18px 8px, gap 14):
  - **Add-reaction button** (`.react-add`): 36px circle, 1.5px **dashed** `slate` border, `silver` camera icon → check icon once reacted. Tap opens the reaction-capture sheet (§4.7). If feed locked: toast `Post today to react`. If already reacted: toast `Reaction already added`.
  - **Reaction stack**: 34px circular photo chips overlapped −9px, 2px `black` borders, each showing the reactor's live selfie (mock: scene + initial). Your own chip gets a `white` border.
  - Count: mono 11 `fog` — `“{n} live reaction(s)”`.
  - Right: **comment toggle** — comment icon + count, `fog` 12px 600.
- **Comments block** (`.comments`): collapsed `max-height: 0` → open 420px, 320ms emphasized.
  - Comment row: 28px avatar + body 13px `mist` lh 1.4; bold handle `white`; trailing mono 10px `ash` time.
  - Empty state: `No comments yet. Say something.`
  - Input row: 30px my-avatar + pill input (`.comment-input`: bg `graphite`, 1px `iron`, radius 999, padding 9px 16px, 13px `bone`, placeholder `Add a comment…` in `ash`) + 36px white circular send button (black send icon). Enter or send posts; toast `Comment posted`.
  - Collapse control: centered text button `HIDE COMMENTS`, `ash` 11px 600 ls 0.04em.

### 4.5 Live "Spot me" strip (`.live-strip`)
Horizontal scroller, gap 12, padding 6px 18px 4px, items 62px wide.
- **Ring** 56px circle, 1.5px border: `iron` (offline) / `white` (live) with **ringpulse** animation: box-shadow `0 0 0 0 rgba(255,255,255,0.25)` ↔ `0 0 0 7px transparent`, 1.9s ease-in-out infinite (respect reduced motion). 46px avatar inside.
- **Name**: 10px, first name, `fog` (offline) / `mist` (live), ellipsis. After you spot someone it reads `◎ spotted`.
- Tap live → **Spot sheet**: big 82px ring (white, pulsing) + avatar 66 + hanging `LIVE` badge; title `{Name} is at the gym` (700/17 `white`); sub `{note} · {gym}` (12.5 `fog`) e.g. `Push day · 25 min in · Gold's Gym Chelsea`; buttons: ghost `Profile` (flex 1) + solid `Send a spot 👊` (flex 1.5) → toast `You spotted {Name} 👊`, button label becomes `◎ Spotted`.
- Tap non-live → their profile panel.

### 4.6 Locked feed state
Until today's daily is posted:
- All post content blurred: media/caption/reactions/chips `blur(14px) saturate(0.8)`; username+location `blur(6px)`; posts non-interactive. Live strip and segmented control remain usable.
- **Lock overlay** across the feed area: gradient scrim `rgba(0,0,0,0.15) → 0.55 (45%) → 0.15`; sticky centered card (max-width 270, top ~120):
  - 58px circle lock icon (1.5px `slate` border, bg `rgba(10,10,10,0.85)`);
  - title (display font 17px lh 1.5 `white`): `Go to the gym to unlock today's feed.`
  - sub (13px `silver` lh 1.5): `Post today's front-and-back to see what everyone else is doing.`
  - CTA pill: `📷 Post today's SPOTTED` → opens camera.

### 4.7 Reaction capture sheet
- Title centered `Live reaction`; sub `Front camera · one quick shot`.
- **Selfie viewport**: 190px circle, 2px `slate` border, live front-camera preview; animated scan line (white 12% band sweeping vertically, 2.2s linear infinite).
- 64px shutter button (white ring style, §6.2) → white flash (90ms in, ~150ms total), sheet closes, your chip joins the stack, toast `Live reaction added`.

---

## 5. FRIENDS tab

Header title `Friends`; segmented `Messages` | `Find Friends`.

### 5.1 Messages (inbox)
List of `.row.row-press` conversations:
- DM: 46px avatar. Group: group-avatar (two 30px overlapped).
- Name (user's full name or group name: `Leg Day Crew`, `5AM Club`); preview sub (unread: `mist` + 600); right column: time (mono) + white unread dot.
- Mock inbox copy: `You hitting Gold's at 6?` (Mia, 12m, unread) · `Jordan: squats then we eat` (Leg Day Crew, 40m, unread) · `That bench PR was clean` (Alex, 2h) · `Octavio: doors at 4:55, no excuses` (5AM Club, 6h) · `Sent you the deload plan` (Sam, 1d).
- Tap → conversation panel; unread clears.

### 5.2 Conversation panel
- Panel head: title = name, sub = handle or member list (`Jordan, Sam, You`; `Octavio, Mia, +3`).
- Body (`.convo-body`): column gap 4, padding 8px 16px 16px, min-height 55%; scrolls to bottom on open.
  - Time separator: centered mono 10px `ash` ls 0.06em (`Today 8:02 AM`, `Yesterday`, `Monday`).
  - Bubbles: max-width 76%; padding 9px 13px; radius 16; 13.5px lh 1.4. Theirs: `bone` on `charcoal` + 1px `iron` border. Mine: right-aligned, black on `white`.
  - Group chats show sender first-name above their bubbles (`.who`: 10.5px `fog` 600, pl 12, mt 6).
- **Input bar**: sticky bottom, gradient bg `transparent → black 32%`, padding 10px 16px 14px; pill input placeholder `Message…` + white circular send. Enter/send appends bubble, updates inbox preview to `You: {text}` and time `now`, scrolls down.

### 5.3 Find Friends
- **Search box**: margin 2px 18px 8px, bg `graphite`, 1px `iron`, radius 12, padding 10px 14px; search icon `ash`; input 14px `bone`, placeholder `Search people`. Typing live-filters all rows by name+handle; section labels hide while searching; empty state `No one found. Try a different name.`
- Sections (mono labels): `Mutual friends`, `Nearby`, `Suggested`, `From your contacts`.
- Row: 46px avatar; name; sub `{handle} · {note}` (notes: `3 mutual friends`, `1 mutual friend`, `1.8 mi · Equinox Bryant Park`, `2.6 mi · Crunch Fulton`, `Popular near Brooklyn`, `From your contacts`); trailing relationship button.
- **Relationship state machine** (`none | requested | incoming | friend | following`):
  - `none` → button `Add` (primary) → tap → `requested`, toast `Friend request sent`.
  - `requested` → `Added` (quiet) → tap → back to `none`, toast `Request withdrawn`.
  - `incoming` → `Add Back` (primary) → tap → `friend`, toast `You and {Name} are now friends`.
  - `following` → `Following` (quiet) → tap → `none`, toast `Unfollowed`.
  - `friend` → `✓ Friends` (quiet, non-interactive).
  - State changes re-render list and any open profile panel's button.

---

## 6. CAMERA

Full-screen slide-up layer. Mode chosen automatically: `daily` if not yet posted today, else `lift`.

### 6.1 Shared chrome
- **Top bar** (`.cam-top`): below status inset, padding 8px 16px; left close/back button (40px circle, bg `rgba(0,0,0,0.5)`, 1px `slate` border, white icon); center **step pill** (`.cam-step`: mono 11 ls 0.14em uppercase `white`, bg `rgba(0,0,0,0.55)`, 1px `slate` border, padding 7px 14px, radius 999); right flip-camera button (same style as close).
- **Viewfinder**: full-bleed camera preview + rule-of-thirds grid (1px lines `rgba(255,255,255,0.05)`, 33.4% cells).
- **Bottom area** (`.cam-bottom`): gradient `transparent → rgba(0,0,0,0.7)`, column centered, gap 16, padding 20px 0 40px (+inset).
- **Shutter** (`.shutter`): 76px circle, 4px `white` border, inner white disc inset 5px. Press: outer scale 0.94, inner 0.88 (120ms). Recording state (`.rec`): inner becomes a rounded **square** (inset 22, radius 10, color `mist`).
- **Mode row**: two pills (`.cam-mode`: mono 11 ls 0.12em uppercase, `fog`, padding 8px 16px, radius 999; ON = `white` text, 1px `slate` border, bg `rgba(0,0,0,0.5)`; disabled 0.35 opacity):
  - `Daily` (label `Daily ✓` and disabled once posted) · `Max lift` (disabled until daily posted; attempting → toast `Post your daily first`).
- **Flash**: full-screen `pure` overlay to opacity 0.9, 90ms linear, off after ~150ms, on every capture.

### 6.2 Daily flow (BeReal-style, two captures)
1. **Capture 1 — back camera.** Step pill `BACK · 1 OF 2`. Shutter → flash → step 2.
2. **Capture 2 — front camera.** Step pill `FRONT · 2 OF 2`. Shot-1 thumbnail top-left (`.cam-shot-thumb`: 84px wide, aspect 3/4, radius 12, 2px `white` border, shadow `0 8px 22px rgba(0,0,0,0.6)`, positioned at inset-top + 62 / left 16). Shutter → flash → review.
3. **Review.** Black bg; combined preview card (`.compose-fb` at 78% width, aspect 3/4, radius 18, 1px `iron` border; front-photo inset 34% width). Top bar: back arrow (returns to capture 1), pill `FRONT & BACK`. Bottom: solid button `Continue ›` (18px side padding).
4. **Compose** (§6.4). 5. **Preview** (§6.5).

### 6.3 Max-lift flow (video)
1. **Record.** Step pill `MAX-LIFT VIDEO`. Above shutter, a rec timer pill (mono 12 `white`, bg `rgba(0,0,0,0.6)`, 1px `slate` border, radius 999, padding 6px 14px) hidden until recording: blinking 8px white dot (1s blink, opacity to 0.2) + `0:SS` counting seconds. Shutter tap starts recording (rec state), second tap stops → flash → lift-meta.
2. **Lift meta — "Which lift?"** Compose-style page; back arrow → record step. Preview card with play badge. Section `Lift`: choice rows `Bench press` / `Squat` / `Deadlift` with check-rings (single-select; default Bench press). Section `Weight`: chip row `225 lb · 245 lb · 275 lb · 315 lb` (rank-cat chips, single-select; default 245 lb — real app: numeric input). Solid `Continue` → compose.
3. **Compose** (§6.4 — title `Max-lift post`, media shows lift-tag `🏆 {lift} · {weight}` + play badge; back → lift-meta). 4. **Preview** (§6.5).

### 6.4 Compose ("Today's post" / "Max-lift post")
Scrollable black page.
- Head (non-sticky panel-head): back arrow + title `Today's post` or `Max-lift post`.
- Media preview: `.compose-fb` 62% width centered, aspect 3/4, radius 18, 1px `iron` border (daily: with 34% inset; lift: lift-tag + play badge).
- Section label `DETAILS`, then four opt-rows:
  1. **Gym** (pin icon) — value `Choose` → gym name / `Home gym` / `Other location`.
  2. **Tag friends** (tag icon) — `None` → comma list of first names.
  3. **Music** (music icon) — `None` → track title.
  4. **Communities** (users icon) — `None` → comma list of community names.
- Section label `CAPTION`; textarea (`.caption-field`: bg `graphite`, 1px `iron`, radius 12, padding 12px 14px, 14px `bone`, min-height 64, placeholder `Say something about today…`).
- Solid button `Preview post`. Guard: if no gym chosen → toast `Choose a gym or location first` + auto-open gym sheet.

**Gym sheet — "Where was this?"** Sub: `Mapped gyms show on the post. Home gym and unlisted spots won't claim a mapped gym.` Rows: each mapped gym (38px circular dumbbell icon; sub `{addr}` + ` · You're here` when GPS-near) with check-ring; hairline; `Home gym` (home icon, sub `Not a mapped gym`); `Other / unlisted` (pin icon, sub `Not a mapped gym`). Picking closes the sheet and **clears any selected gym-communities that no longer match the location**.

**Tag friends sheet.** Title `Tag friends`; multi-select choice rows of friends (40 avatar, name, handle, check-ring); solid `Done`.

**Music sheet — "Add music".** Rows (music icon, title/artist, check-ring): `Ambition — Wale`, `Till I Collapse — Eminem`, `Runnin — 21 Savage`, `Stronger — Kanye West`, `HUMBLE. — Kendrick Lamar`; final row `No music` (x icon) clears. Single-select; picking closes.

**Communities sheet — "Share to communities".** Sub: `Gym communities need you at that gym. Custom communities are always open to you.` Multi-select rows (38px comm icon, name, sub `{Type} · {n} members`); **gym-type communities are disabled** (0.38 opacity, sub `You must be at this gym to post here`) unless `cam.gym` equals that gym. Solid `Done`.

### 6.5 Preview & publish
- Head: back arrow → compose; title `Preview`.
- Label (mono 10.5 ls 0.14em uppercase `fog`, centered): `THIS IS HOW IT POSTS`.
- **Preview card**: 1px `iron` border, radius 16, margin 0 18px, bg `ink` — renders the real post card exactly as it will appear in feed (media aspect 3/3.2 here). Caption is auto-built: `{caption} {@tags…} · ♪ {track} — {artist}`.
- If communities selected: sub-line `Also shared to: {names}`.
- Actions row (gap 10): ghost `Edit` (flex 1) + solid `Publish` (flex 2).
- **Publish, daily**: stores post, marks posted-today (persist; resets at local midnight), camera closes, navigate Home→Friends tab, feed unlocks, camera tab gets posted-dot, toast `Posted. Feed unlocked.`
- **Publish, lift**: stores lift post at top of friends feed, prepends to profile Videos/achievements (`{lift}, {weight}, Today`), toast `Max-lift video posted`.

---

## 7. MAP tab (Communities | Map)

Header title switches: `Communities` / `Map`. Segmented `Communities` | `Map`.

### 7.1 Communities list
1. Section `THIS WEEK` → **Weekly challenge card** (§7.4).
2. Section `YOUR GYMS` → gym communities the user has joined.
3. Section `YOUR COMMUNITIES` → non-gym communities.
- **Community card** (`.comm-card`): margin 0 18px 10px, padding 13px 14px, 1px `iron` border, radius 14, bg `graphite`; active bg `charcoal`.
  - 46px icon tile (radius 12, 1px `slate` border, `mist` icon: dumbbell/users/school/sun).
  - Name 700/14.5 `white` + type-pill (`GYM`, `FRIENDS`, `COLLEGE`, `CUSTOM`); meta `{n} members` (12 `fog`); activity line 12 `silver` ellipsis (e.g. `Dana posted a deadlift PR · 34m`, `Jordan: squats then we eat · 40m`, `Fresh posts rolling in`, `Octavio opened the chat · 6h`).
  - Right column: `{n} today` today-pill + 36px circular chat shortcut (comment icon, 1px `slate` border) that deep-links to the community's Chat tab.

### 7.2 Community page (panel)
- Panel head: name + sub `Gym community` / `{Type} community`.
- Hero: name in **display font 21px** lh 1.5; meta 12.5 `fog`: `{addr} · {n} members · Posts require being at this gym` (gym) or `{n} members`.
- **Tabs** (`.comm-tabs`: underline style, gap 22, border-bottom 1px `graphite`; tab 600/13.5 `fog`, active `white` + 2px white underline): `Posts` · `Chat` · `Rankings` (Rankings only for gym communities).
- **Posts**: 3-column photo grid, 2px gaps, cells aspect 3/4; overlay bottom-left handle chip (9.5px 700 white on `rgba(0,0,0,0.6)`, radius 6, padding 3px 7px); optional 30px play badge for videos. Tap cell → that user's profile (own → my profile tab).
- **Chat**: same bubble system as DMs, sender names on, min-height 280; sticky input `Message the community…` + send.
- **Rankings**: category chips `Max lifts · Streaks · Friends · Trophies`; when Max lifts: second chip row `Bench press · Squat · Deadlift`. Rank rows: position (mono 13 `fog`; #1 white 700) + 34 avatar + name (+ `(you)` in `fog`) + handle + right value (mono 13 `white` 500 + small unit `fog` 10px: `315 lb`, `61 days`, plain counts).

### 7.3 Map view
- Container: full remaining height (`calc(100% − 108px)`, min 480); bg radial `#17171A → #0C0C0E 60% → #060607` (120% 90% at 30% 20%).
- Street grid: SVG — minor lines `#222227` (2w), major `#2C2C31` (4w), park fill `#121215`, water `#0A0A0D`. Area labels (mono 9px ls 0.18em uppercase `slate`): `MIDTOWN`, `CHELSEA`, `BROOKLYN`. *(Real app: dark-styled real map.)*
- **Self dot**: 14px white circle, 3px `slate` border; expanding pulse ring (border `rgba(255,255,255,0.18)`, scale 0.6→1.5 fading, 2.4s infinite).
- **Gym markers**: 44px circles, bg `ink`, 1.5px `mist` border, white dumbbell icon, shadow `0 6px 18px rgba(0,0,0,0.65)`; member-count badge top-right (mono 9 700 black on `white` pill). **Live state** (friends currently there): white border + markerpulse ring (to 11px, 2s infinite). Tap (scale 0.9 press) → gym preview sheet.

### 7.4 Gym preview sheet
- Head: 50px circular dumbbell icon (1.5px `mist` border, bg `ink`); name 700/17; addr 12.5 `fog` (+ ` · 0.4 mi` when nearby).
- Stats row (gap 20): `{members} Members` · `{n} Friends` · `{n} Here now` (mono 700/16 white numbers, 11px `fog` labels).
- Friends context: overlapped 24px chips + `Mia and Jordan train here` / `No friends here yet` (12.5 `silver`).
- **Here-now block**:
  - none: dashed-border quiet card (1px dashed `slate`, radius 12, 11.5px `fog`): `○ No friends here right now — check in and you'll be the first.`
  - some: **here-row** (1px `slate` border, radius 12, bg `rgba(255,255,255,0.035)`): pulsing 8px white dot (dotpulse 1.8s) + up-to-3 24px avatar chips + `**{n} friends here now** · tap to see who` + caret `⌄` (rotates 180° when open). Expands a bordered list: 34 avatar, name (`You` for self), note (`Push day · here 25 min`, `Just checked in`), and per-friend `Wave` chip button → becomes `◎ Waved`.
- Actions (gap 10): ghost `◎ Check in` (flex 1) · ghost `Join`/`✓ Joined` toggle (flex 0.9, toast `Joined/Left {gym}`) · solid `Community` (flex 1.2 → opens community page).
- Check in: adds `You — Just checked in` to here-now (dupe → toast `Already checked in here`), toast `Checked in at {gym}`, refreshes sheet + live map markers.

### 7.5 Weekly challenge (gym vs gym)
- **Card**: margin 0 18px 12px, 1px `slate` border, radius 16, padding 16, bg `linear-gradient(160deg, graphite, ink)`; active `charcoal`.
  - Tag: mono 9.5 ls 0.24em uppercase `silver`: `◎ GYM VS GYM · WEEKLY CHECK-INS`.
  - VS row: team names in display 14px ls 0.03em (`GOLD'S CHELSEA` white vs `EQUINOX BP` `fog`), `VS` mono 10 `ash`.
  - Progress bar: 9px pill track `iron`, white fill = a/(a+b) share, width animates 400ms emphasized.
  - Numbers row: mono 10.5 `fog`: `**214** check-ins` · `ends in 2d 14h` · `**158** check-ins`.
- **Challenge sheet** (tap card): title `Weekly challenge`; sub `Most member check-ins by Sunday night takes the banner.`; repeated VS + bar + numbers; section `TOP CONTRIBUTORS — GOLD'S` with rank rows (name + `{n} this wk`, rows link to profiles); solid CTA `◎ Check in at Gold's — count me in` → increments team + personal count, closes, toast `Checked in — +1 for Gold's`.

---

## 8. PROFILE (own)

### 8.1 Layout
1. Header title `Profile`.
2. **Identity row**: 72px avatar; name 700/19 ls −0.02em; handle 13 `fog`; gym line 12.5 `silver` with pin (`Gold's Gym Chelsea`).
3. **Pinned trophies row** (`.pin-row`, wrap, gap 8): trophy chips (`.pin-trophy`: 1px `slate` border, bg `graphite`, radius 10, padding 8px 12px, 12px 700 `bone`, white trophy icon 13) — e.g. `405 Club — Deadlift`, `30-Day Streak`. Tap → trophy detail.
4. **Counts row** (gap 8): two flex cells (1px `iron` border, radius 12, padding 11px 12px, bg `graphite`; active `charcoal`): big number mono 500/18 `white`, label 11 `fog` 600 — `48 Friends` · `112 Following`. Tap → respective sheets.
5. **Quadrant grid** (`.quad-grid`: 2×2, gap 10, padding 16px 18px 4px). Each quad: square, 1px `iron` border, radius 18, bg `linear-gradient(165deg, graphite, ink)`, decorative 150px circle (1px `iron`) at top −70/right −60, centered column gap 10, padding 16px 14px; active bg `charcoal`.
   - Icon: 54px circle, 1.5px `mist` border, white 24px icon.
   - Name: **display font 13px** ls 0.06em `white` — `STATS`, `TROPHIES`, `VIDEOS`, `POSTS`.
   - Desc: 10.5 `fog` lh 1.45 max-width 130 — `Streak, best lifts & verified PRs` · `{n} earned, each with proof` · `{n} max-lift videos & milestones` · `{n} dailies, month by month`.

### 8.2 Stats panel
Head `Stats` / sub `Your numbers at a glance`.
- Stat strip (3 cells, 1px `iron`, radius 12, padding 11px 12px): `{streak} days — Gym streak` · `{n} — Daily posts` · `{n} — Verified PRs` (numbers mono 16, units 10px `fog`).
- Section `BEST LIFTS — VERIFIED`: rows (36px dumbbell icon tile) `Bench press / Squat / Deadlift`, sub `Ranked #{k} at Gold's Chelsea`, right mono value `245 lb` etc.
- Section `COMMUNITY STANDING`: row (flame icon) `Streak rank — Gold's Gym Chelsea leaderboard — #3`.

### 8.3 Trophies panel
Head `Trophies` / sub `{n} earned · tap one for its proof`. 2-col trophy grid:
- Card: 1px `iron` border, radius 14, padding 13, bg `graphite`; optional `PINNED` flag top-right (`fog`); white trophy icon 19; name 700/13 `bone` mt 9; meta 11 `fog` mt 3 — `{Cat} · {meta}`.
- Data: `405 Club — Deadlift` (Lifting · Verified by max-lift video, pinned) · `30-Day Streak` (Streak · 30 daily posts in a row, pinned) · `225 Club — Bench` (Lifting · Verified by max-lift video) · `Gold's Top 5 — Squat` (Community · Ranked #4 at Gold's Chelsea) · `Squad of 25` (Friends · 25 mutual friends). Categories are only: Lifting / Streak / Friends / Community.

### 8.4 Trophy detail panel
Head `Trophy` / sub `{category}`. Centered: 64px trophy circle (1.5px `mist` border); name 800/19 ls −0.02em; meta 12.5 `fog` (+ ` · Pinned to profile`). Section `EARNED BY THIS {max-lift video | achievement post | daily post}` → tappable proof media card (radius 14; lift-tag; play badge + duration for videos; or front-and-back w/ inset for daily proof) → opens the achievement/daily detail.

### 8.5 Videos panel
Head `Videos` / sub `Max-lift videos & achievement posts`. 2-col grid of achievement cards (`.ach-card`: aspect 3/4, radius 14, 1px `slate` border):
- top-left tag `MAX LIFT` / `ACHIEVEMENT` (mono 9 uppercase, white on `rgba(0,0,0,0.7)`);
- bottom-right 28px play badge (videos);
- bottom-left lift line 11px 700 white (text-shadow `0 2px 8px rgba(0,0,0,0.8)`): `Deadlift · 405 lb` + date on line 2 (`fog` 500): `Jun 28`, `Jun 12`, `May 30`, `May 18`.
Tap → achievement detail: head `Max-lift video`/`Achievement post` + date; media card; caption `Verified on camera. No spot needed.` (video) or `Milestone locked in.` (post).

### 8.6 Posts panel (daily archive)
Head `Daily posts` / sub `Your archive, month by month`.
- If posted today: month label `Today` + one cell.
- Month label (`.cal-month`: mono 10.5 ls 0.14em uppercase `fog`): `July 2026`, `June 2026`.
- **Calendar grid**: 4 columns, gap 6; cells aspect 3/4, radius 10, 1px `graphite` border; mini front-photo inset top-left (34%, radius 5, 1px black border); date bottom-left (mono 9.5 white 500, text-shadow `0 1px 6px rgba(0,0,0,0.9)`).
- **Missed day**: bg `graphite`, centered `slate` ✕ icon, date still shown; not tappable.
- Tap → daily post detail: head `Daily post` / `{d} {Month}`; media (radius 14, w/ inset); location line; caption with handle.

### 8.7 Friends / Following sheets
- **Friends**: title `Friends`; sub `Mutual — they added you back · 48 total`; rows (40 avatar, name, `{handle} · {gym}`, quiet `Friends` pill) → profile.
- **Following**: title `Following`; sub `One-directional — public accounts you follow · 112 total`; rows with quiet `Following` pill.

---

## 9. Other-user profile (panel)

- Head: handle (no `@`).
- Identity: 72 avatar; name; handle; gym pin line.
- Relationship button row (padding 12px 18px 0) — same state machine as Find Friends; button re-renders in place on change.
- **Mutuals strip**: up to 3 overlapped 26px avatars (−8px, 2px black borders) + `**{n} mutual friends** · {First}, {First} +{k}` (12 `silver`, bold part `bone`); tap → **Mutual friends sheet** (`You and {First} both know` + rows → their profiles). No mutuals: `No mutual friends yet`.
- Section `RECENT POSTS`: their full post cards; empty/gated state: `Posts unlock when you're friends.`

---

## 10. Animation inventory (summary)

| Animation | Spec | Trigger |
|---|---|---|
| Tab switch | opacity 0→1 + scale 1.015→1, 280ms emphasized | tab tap |
| Panel push/pop | translateX 100%→0, 300ms emphasized (pop reversed, 320ms cleanup) | row/avatar taps, back |
| Sheet | translateY 105%→0, 320ms emphasized; backdrop fade 240ms | sheet open/close, backdrop tap |
| Camera open/close | translateY 100%→0, 340ms emphasized | camera tab, lock CTA |
| Press feedback | scale 0.965 + opacity 0.85, 140ms standard | all pressables |
| Toast | fade + 16px rise, 220ms; 2100ms dwell | actions |
| Flash | white 0.9 opacity, 90ms linear in, off ~150ms | captures |
| Comments expand | max-height 0→420, 320ms emphasized (RN: measured height/layout animation) | comment toggle |
| Video progress | width 0→100% linear over duration (mock 4.1s) | tap-to-play |
| Live ring pulse | box-shadow 0→7px white 25%, 1.9s ∞ | live friends (reduced-motion gated) |
| Here-now dot pulse | shadow 0→7px white 50%, 1.8s ∞ | gym sheet |
| Map marker pulse | ring to 11px, 2s ∞ | live gym markers |
| Map self pulse | ring scale 0.6→1.5 fade, 2.4s ∞ | always |
| Selfie scan line | translateY −60%→60%, 2.2s linear ∞ | reaction sheet |
| Rec dot blink | opacity to 0.2 @50%, 1s ∞ | recording |
| Challenge bar | width 400ms emphasized | data change |
| Compare slider | clip-path + divider left track finger, immediate | drag |
| Here caret | rotate 180°, 200ms standard | expand/collapse |
| Camera-tab posted dot | static state change | publish |

---

## 11. Business rules encoded in the mockup

1. **Daily lock**: feed is blurred+locked until today's front-and-back is posted; resets at local midnight (persisted date key).
2. **One daily per day**; after posting, camera defaults to Max-lift mode and Daily is disabled (`Daily ✓`).
3. **Max lift requires daily first** (`Post your daily first`).
4. **Live reactions are camera-only** (selfie), one per post, and require having posted today.
5. **Gym communities are location-gated**: posting into a gym community requires the post's location to be that gym; changing location deselects ineligible communities. Community pages state `Posts require being at this gym`.
6. **Mapped vs unmapped location**: Home gym / Other never claim a mapped gym; posts show italic `not a mapped gym` line.
7. **Friends vs Following are distinct**: friends = mutual; following = one-directional public follow.
8. **Trophies always link to proof** (a max-lift video, achievement post, or daily post). Max two pinned shown on profile chip row.
9. **Check-ins** power: live presence ("here now"), map marker liveness, weekly gym-vs-gym challenge score, streak stats.
10. Tapping own content anywhere routes to own profile tab, not a panel.
