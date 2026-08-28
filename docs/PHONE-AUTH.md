# Phone-number sign-up (alongside Sign in with Apple)

Guide to adding SMS-OTP sign-up to Spotted. Split into **manual steps only you
can do** (accounts, dashboards, billing) and the **code changes** that follow.

---

## Part 1 — Manual steps (do these first)

### 1. Pick and set up an SMS provider (Twilio recommended)

1. Create a Twilio account → https://www.twilio.com
2. Buy a phone number (or better: create a **Messaging Service** and add the
   number to its sender pool). Note down:
   - Account SID
   - Auth Token
   - Messaging Service SID (starts with `MG…`)
3. **US A2P 10DLC registration (do not skip):** any application SMS to US
   numbers must be registered. In Twilio Console → Messaging → Regulatory
   Compliance, register a Brand + Campaign ("customer account verification /
   OTP" use case). Unregistered traffic to US numbers gets filtered/blocked.
   This takes a few days to approve — start it early.
   - Alternative with less paperwork: a **Toll-Free number** with toll-free
     verification (also a review process, usually faster).
4. Budget note: OTP SMS to US numbers ≈ $0.008–0.01 each + monthly number fee.

### 2. Enable the Phone provider in Supabase

Dashboard → project `Spotted` (`nvywxqntsrlrmlrpfuub`) → **Authentication →
Sign In / Providers → Phone**:

1. Toggle **Enable Phone provider** ON.
2. SMS provider: **Twilio** → paste Account SID, Auth Token, Messaging Service
   SID.
3. Set the SMS message template, e.g. `Your Spotted code is {{ .Code }}`.
4. **OTP expiry**: 300s is a good default. **OTP length**: 6.
5. Under **Rate Limits** (Authentication → Rate Limits): cap SMS sends
   (e.g. 30/hour) — every OTP costs money and toll fraud (SMS pumping) is a
   real thing. Consider enabling **CAPTCHA protection** (Auth → Attack
   Protection → hCaptcha/Turnstile) if you see abuse.

### 3. Add Test OTPs for App Store review

Apple reviewers must be able to sign in without receiving a real SMS.
Authentication → Providers → Phone → **Test OTPs**: add a test number like
`+15005550006` with a fixed code (e.g. `123456`), and put that number+code in
App Store Connect → App Review Information → notes.

### 4. App Store Connect

- Nothing new is required for phone auth itself. Sign in with Apple stays —
  Apple's guideline 4.8 only requires Apple sign-in when you offer OTHER
  third-party logins (Google/Facebook); phone/email are fine alongside.
- Update the privacy "nutrition label": you now collect **Phone Number** for
  App Functionality / account management.
- Privacy policy: add phone number to the data-collected list
  (PRIVACY_POLICY.md).

---

## Part 2 — Code changes (I can do these once Part 1 is live)

1. **Welcome screen** (`app/(auth)/welcome.tsx`): add "Continue with phone"
   under the Apple button.
2. **New screen** `app/(auth)/phone.tsx`, mirroring `email.tsx`'s two-step UX:
   - Step 1: E.164 phone input (default +1, basic formatting) →
     `supabase.auth.signInWithOtp({ phone })`
   - Step 2: 6-digit code input → `supabase.auth.verifyOtp({ phone, token,
     type: "sms" })` → session lands in the existing auth store; onboarding
     flow (`(onboarding)/create-profile`) takes over exactly like Apple/email.
   - Resend with a 30s cooldown.
3. **Auth store**: no structural change — `useAuthStore.hydrate()` already
   works off the Supabase session regardless of provider.
4. **Account linking** (optional, phase 2): let existing Apple users attach a
   phone in Settings via `supabase.auth.updateUser({ phone })` + `verifyOtp
   ({ type: "phone_change" })`. This is what makes contact-matching work for
   existing users (see below).
5. **AUTH_PATHS** in `app/_layout.tsx`: add `/phone` so the signed-out guard
   leaves the new screen alone.

## Why this also matters for Find Friends

Contact matching is only as good as the identifiers we hold. Apple sign-in
often yields private-relay emails (`…@privaterelay.appleid.com`) that will
never match anyone's address book. Once users hold verified phone numbers,
`match_contacts` (the contacts RPC) matches on phone and quality jumps
dramatically. Prompting existing users to add their number (step 4 above) is
the single highest-leverage growth fix after this ships.
