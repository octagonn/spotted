# declared-age-range — DEFERRED (native side removed)

Bridge to Apple's **Declared Age Range** API (iOS 26+) for the App Store
"Age Assurance" rating. The native module is currently **disabled**: `index.ts`
is a safe stub that always resolves `{ status: "unavailable" }`, so the birthday
screen falls back to the server-enforced date-of-birth gate (13+). The app
behaves identically to before the API was added.

## Why it's deferred

An EAS production build (2026-08, `image: "latest"`) failed to compile the Swift
module with:

```
cannot find 'AgeRangeService' in scope
```

That is a **type-resolution** error, not a signature error — the build image's
SDK exposes a `DeclaredAgeRange` module (so `#if canImport` passes) but does not
declare `AgeRangeService`. The symbol `AgeRangeService.shared.requestAgeRange(
ageGates:in:)` is corroborated by Apple's forums + third-party samples, so this
is an SDK/toolchain-version mismatch on the build image, not a naming mistake.
It cannot be fixed or verified blind — it needs a Mac with Xcode 26 + a real
iOS 26 device (the API refuses to run in the Simulator).

## How to restore (once verifiable on-device)

1. Restore the native files from git — they were removed in the deferral commit;
   the last working copy is at commit **746fc2c**:
   ```
   git checkout 746fc2c -- modules/declared-age-range/ios modules/declared-age-range/expo-module.config.json
   ```
2. On a Mac + iOS 26 device, confirm the exact Swift symbol in a scratch app
   (candidates to verify, in order):
   - `try await AgeRangeService.shared.requestAgeRange(ageGates: 13, 16, 18, in: scene)`
   - SwiftUI: `@Environment(\.requestAgeRange)` → `try await requestAgeRange(ageGates: 13, 16, 18)`
   - Response cases: `.sharing(let range)` / `.declinedSharing`; range has
     `lowerBound: Int?`, `upperBound: Int?`.
   Fix the module to match what actually compiles + runs.
3. Re-add the entitlement to `app.config.ts` `ios.entitlements`:
   `"com.apple.developer.declared-age-range": true`
4. Enable the **Declared Age Range** capability on App ID `com.octavio.spotted`
   in the Apple Developer portal, then let EAS regenerate the provisioning
   profile.
5. Pin `eas.json` production `image` to a version whose SDK includes the real
   framework API (verify against the on-device test).
6. Only after the build ships and the sheet works: flip App Store Connect
   Age Rating → **Age Assurance: Declared Age Range**.

`index.ts` is intentionally kept — the birthday screen imports it, and its
try/catch already degrades to `unavailable` when no native module is linked.
