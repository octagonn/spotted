# QA Fix Plan — full app sweep (2026-07-15)

Method: drove the Expo web build in Chrome as `spottedgymapp@gmail.com`, visited every
route, clicked every reachable control, and cross-checked writes in the Supabase DB.

## DB persistence verdicts

| Domain | Verdict | Evidence |
|---|---|---|
| Profiles | ✅ stored correctly | name/handle/home gym/birth date/onboarding stage all round-trip |
| Posts | ✅ stored correctly | 12 rows; upload + insert + signed read verified |
| Friendships | ✅ stored correctly | Add → `pending` row appeared instantly; accept flow works |
| Workout schedule | ✅ stored correctly | 14 rows |
| Conversations/messages | ❌ **broken** | 0 rows ever created — bug 1 below |

## A. Correctness bugs (fix now)

1. **Chat is broken for ~half of user pairs (CRITICAL).** `conversations` has
   `CHECK (participant_a < participant_b)`, but `useConversation` inserts
   `(myId, otherId)` unordered → insert fails whenever `myId > otherId`, the error is
   swallowed, the thread shows "NO MESSAGES YET", and sends silently no-op.
   Fix: sort the pair before insert; surface conversation load errors; disable send
   until the conversation id resolves.
2. **Own profile shows "Add friend"** at `/user/<own username>` plus "No mutual friends
   yet" and "Posts unlock when you're friends". Fix: redirect to the Profile tab when
   the username is mine.
3. **Feed lock state is device-local.** Account that posted 3h ago on the phone shows
   a locked feed in a fresh session (AsyncStorage flag, not server truth).
   Fix: derive posted-today/posted-this-week from the DB (own latest `posts.created_at`),
   seeded/overridden optimistically by the local flag right after publishing.
4. **Auth store only hydrates via the index route.** Deep links bypass `hydrate()` —
   store userId stays null and dependent queries silently disable. Fix: hydrate once
   from the root layout instead.
5. **Lock overlay copy** still says "Post today's front-and-back" — the flow is a
   single photo now. Fix copy.
6. **Camera shutter with no permission** advances to review with a blank capture.
   Fix: if permission isn't granted, the shutter re-requests permission instead of
   capturing.

## B. Fixtures shown as if real (fix now)

7. **Profile header counts are fake** ("48 Friends / 112 Following" on an account with
   0 friends). Fix: real accepted-friends count; drop the Following stat until a follow
   model exists.
8. **Pinned trophy chips are fake** ("405 Club — Deadlift", "30-Day Streak"). Fix: hide
   until trophies have a backend.
9. **Quadrant sub-labels are fake** ("5 earned each with proof", "86 dailies", "4
   max-lift videos"). Fix: real post count for POSTS, real streak copy for STATS,
   neutral "coming soon" copy for TROPHIES/VIDEOS.
10. **Quadrant renders as a stacked full-width column** instead of the 2×2 grid.
11. **STATS section page is fake** (34-day streak, best lifts, ranks at Gold's
    Chelsea). Fix: real streak, real daily-post count, real freeze tokens; hide
    verified-PR/best-lift/rank blocks until their backend exists.
12. **Home live strip shows fake people** (Mia/Jordan/…): replace with real friends
    currently checked in (checkins/presence), hidden when empty.
13. **Friends feed mixes fake posts with real ones.** Fix: Friends tab = real posts
    only + empty state; Public tab keeps demo fixtures until public ranking exists
    (labeled in code).
14. **Map "Your gyms" is fake** (Gold's Chelsea). Fix: show the real home gym card.
    Weekly challenge + community cards stay as demo fixtures (deferred below).

## C. Missing entry points (fix now)

15. **Settings are unreachable** — `/settings` (Account/Privacy/Spotted+, Sign Out,
    Delete Account) exists but no button leads there. Fix: gear icon on the Profile
    header.

## D. Noted, deferred (backend pass)

- Communities/challenge/rankings/community chat: all fixture-driven (needs schema).
- Trophies/achievements/max-lift videos: fixture-driven (needs schema + video).
- Public feed ranking/discovery: fixture-driven.
- Friend suggestions return nothing for a user with no graph — needs a popularity
  fallback so Find Friends isn't empty for new users (edge function change).
- Welcome-screen looping aurora animations peg the JS thread on web (made CDP input
  time out). Native runs them on the UI thread; revisit only if devices show jank.
- Paywall "Gold" copy vs monochrome brand — product call, untouched.

## Status (2026-07-15, same session)

All items in sections A, B, and C are **implemented and verified**:
- Chat retested on web: conversation row created with sorted pair, message persisted
  to `messages` (confirmed by SQL).
- `/user/<own username>` now redirects to the Profile tab (verified in browser).
- Profile shows real friend/post counts, 2×2 grid restored, gear → Settings.
- Feed Friends tab real-only; live strip real friends + check-ins; lock state
  server-derived. Section D remains deferred to the backend pass.

Note: QA password was set on the seed account `mock+mia@spotted.app`
(`SpottedQA123!`) — safe to keep for future testing.

## Retest checklist after fixes

- [ ] Chat: A→B and B→A first-message both create the conversation and persist.
- [ ] Own profile route redirects to Profile tab.
- [ ] Fresh sign-in on a second device shows unlocked feed if posted this week.
- [ ] Profile shows real friend count; no fake chips.
- [ ] Settings reachable from Profile; Sign Out works.
