# Background gym-arrival detection (1.3.0)

Ships in the first native build ≥ 1.3.0. Code: `lib/gymGeofence.ts`, wired from
`hooks/useGeofence.ts` (`usePresenceSync`), onboarding `permissions.tsx`, and
Settings → Notifications ("Arrival buzz with the app closed").

## How it works (Life360 model, not continuous GPS)

1. Home gym → ONE OS geofence (`startGeofencingAsync`), radius
   `max(gym radius + 50 m, 150 m)`. The OS watches it with cell/Wi-Fi power and
   cold-launches the JS bundle on enter/exit even if the app was swiped away.
2. **Enter** → start a short GPS "settle" stream (`startLocationUpdatesAsync`,
   High accuracy, 15 m / 10 s). First fix inside the real 75 m fence calls the
   `checkin` RPC — the server re-verifies distance, dedupes open check-ins, and
   its trigger sends the arrival push. Stream stops immediately after, on exit,
   or after 15 min. GPS therefore runs only for the minutes between "near the
   gym" and "inside the gym".
3. **Exit** → one fix; if it agrees we're outside, close the open check-in.
4. Foreground sync (`usePresenceSync`) still runs as before and re-arms the
   fence on every app open / home-gym change. If the OS wake fails for any
   reason the old behaviour is the fallback.

Safety rails: every entry point is gated on `Constants.nativeAppVersion >= 1.3.0`
and not Expo Go, and wrapped in try/catch. `runtimeVersion = appVersion` means
OTAs from this tree never reach a 1.2.1 binary anyway.

## Permissions

- iOS: `UIBackgroundModes: [location]`, `NSLocationAlways*` strings explain the
  geofence. The app asks While Using → Always in onboarding, and existing users
  get one in-context prompt (`appAlert`) right after a foreground check-in.
  iOS 13+ may grant *provisional* Always and show its own "Change to Always
  Allow?" sheet the first time the fence fires — expected.
- Android: `ACCESS_BACKGROUND_LOCATION` + foreground service for the settle
  stream (notification "Confirming you made it to the gym."). Google Play
  requires the background-location declaration + demo video before release.

## App Store Connect — paste-ready

**App Privacy → Location → Precise Location**: collected, linked to user, used
for App Functionality. Not used for tracking.

**App Review notes:**

> Spotted requests "Always" location for one purpose: detecting arrival at the
> user's chosen home gym so the app can check them in and send an arrival
> notification without being opened. Implementation uses a single Core Location
> region (geofence) around the home gym; there is no continuous location
> tracking, no location history, and no location sharing beyond "present at
> gym" to friends the user explicitly added. When the region is entered the app
> takes a brief position fix to confirm the user is inside the gym, records the
> check-in, and stops. The feature is optional — "While Using" keeps every
> feature working, with check-ins happening when the app is opened. Disclosed
> in Privacy Policy §6 and Terms §7.

## Testing on device

1. Install the 1.3.0 build (TestFlight). Open once, sign in, make sure a home
   gym is set.
2. iOS Settings → Spotted → Location → **Always**, Precise Location on.
3. Force-quit the app. Leave the gym's 150 m radius (a few blocks), come back.
4. Expect the arrival buzz within ~1–3 min of walking in — without opening the
   app. `checkins` gets a row with `source = 'geofence'`.
5. Leave: the check-in's `checked_out_at` should be set within a few minutes.

Simulator: Xcode → Debug → Location → Custom Location works for enter/exit
(set a point > 200 m away, then the gym coordinates).

## Legal

Policy/Terms text changed from "we do not collect background location" to the
optional-geofence wording (`PRIVACY_POLICY.md`, `TERMS_OF_USE.md`,
`components/LegalModal.tsx`); `LEGAL_VERSION` bumped to 2026-09-12, so existing
users see the policy-update notice once. Mirror the two markdown files to the
public repo `octagonn/spottedtermsandprivacy` before submitting the build.
