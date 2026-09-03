# Win-back campaign — staged, NOT sent

Prepared 2026-08-30. Everything is staged in Resend; **nothing sends until you
say so**, after the Sept 1 App Store build is live.

## What's staged

| Piece | Where | ID |
|---|---|---|
| Segment: no home gym (43 recipients) | Resend | `c1aec144-c39b-4063-af6f-2cef1dde2e5c` |
| Segment: gym set, never checked in (32) | Resend | `e82bc3b1-f29f-4ec8-a5ee-165d633d3a11` |
| Broadcast A: "you downloaded Spotted and then life happened" | Resend draft | `607bd4fc-be6e-48cb-813c-f97914479b8a` |
| Broadcast B: "your gym's on Spotted. you're the one missing" | Resend draft | `6b7e493a-25ad-42cf-9029-1289a342ac89` |

Sender: `Ethan from Spotted <ethan@notifications.spottedgymapp.com>` (domain
verified in Resend). Plain text on purpose — it should read like a person,
not a campaign. Personalization: `{{{FIRST_NAME|there}}}`; junky display
names were blanked so the fallback reads naturally.

Excluded on purpose: `apple-review@spottedapp.test`, `support@spottedgymapp.com`,
the `test` profile, and 2 duplicate no-profile signups of people who also have
a real account.

Preview/edit: https://resend.com/broadcasts/607bd4fc-be6e-48cb-813c-f97914479b8a
and https://resend.com/broadcasts/6b7e493a-25ad-42cf-9029-1289a342ac89

## Pre-send checklist (Sept 1, after the build is approved)

1. **Reply-to**: the emails promise "hit reply and tell me why". Decide the
   inbox (e.g. `ethan@spottedgymapp.com`) and make sure it exists and is read;
   set it as Reply-To on both broadcasts in the Resend dashboard. Without
   this, replies go to the notifications subdomain.
2. **Apple private relay**: ~10 recipients use `@privaterelay.appleid.com`.
   Those only deliver if `notifications.spottedgymapp.com` is registered in
   App Store Connect → Services → Sign in with Apple → certificates/email
   sources. If it isn't, register it or accept the bounces.
3. **Send B before A** (gym-set is the warmer segment; any deliverability
   issues surface on the smaller batch), then A a few hours later.
4. Sends go out via the Resend dashboard's Send button on each broadcast
   (or ask Claude to `send-broadcast` with the IDs above).

## After the send

- **Second touch** (~Sept 8): ONE follow-up to non-openers only, leading with
  the feedback ask ("what made you bounce?"). No third email.
- **Replies are user research** — log them.
- Track: open rate, and the real metric — `checkins` from these user ids in
  the following 14 days.

## Optional: win-back push (19 lapsed users have live device tokens)

`send-push` is pipeline-driven (notification rows + buckets), so an ad-hoc
win-back push is a small eng task, not a button. If wanted: insert rows the
pipeline understands (respects quiet hours/prefs) or add a `winback` type.
List the targets with:

```sql
select distinct dt.user_id from device_tokens dt
where not exists (select 1 from checkins c where c.user_id = dt.user_id);
```

## OTA updates (in the Sept 1 build)

`expo-updates` is installed and configured (channel per build profile,
runtimeVersion policy `appVersion`). Once the Sept 1 binary is live, JS/asset
fixes ship instantly without a build or review:

```bash
npx eas-cli update --channel production --message "what changed"
```

Users get it on their next two app launches (download on first, applied on
second). Native-module changes still need a real build + store review.

## Product side (already shipped, supports the email's promise)

- Home gym is a hard gate; 37 gymless "complete" accounts get re-gated into
  the picker on next app open, then flow through the new add-friends step.
- The email's "60 seconds: pick your gym, add two people" is literally the
  path the app now enforces.

## Also recommended, separate from this campaign

- Nudge the 16 active users to add their quiet gym-mates (friend request from
  a real friend beats any founder email). Feature-sized; not built yet.
- Friend-request email notifications for lapsed users — highest-converting
  message long-term. Not built yet.
