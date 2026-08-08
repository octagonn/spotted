# declared-age-range

Bridge to Apple's **Declared Age Range** API (iOS 26.2+) — the Age Assurance
mechanism the App Store age-rating questionnaire requires for a 13+ social/UGC
app. On unsupported OS/builds it resolves `{ status: "unavailable" }` and the
birthday screen falls back to the server-enforced date-of-birth gate.

## Verified API (Apple docs)

```
AgeRangeService.shared.requestAgeRange(ageGates: Int, _: Int?, _: Int?, in: UIViewController)
  async throws -> AgeRangeService.Response
Response: .sharing(range: AgeRange) | .declinedSharing
AgeRange: lowerBound: Int?, upperBound: Int?
```

`AgeRangeService` is finalized in the **iOS 26.2 SDK**; the module guards
`#available(iOS 26.2, *)` and `#if canImport(DeclaredAgeRange)`.

## Build requirements

- **EAS image ≥ Xcode 26.2** (pinned to `macos-tahoe-26.5-xcode-26.6` in
  `eas.json`). Older Xcode fails with `cannot find 'AgeRangeService' in scope`.
- Entitlement `com.apple.developer.declared-age-range` in `app.config.ts`.
- The **Declared Age Range capability must be enabled on the App ID**
  (`com.octavio.spotted`) in the developer portal, then EAS regenerates the
  provisioning profile.
- `DeclaredAgeRange` is **weak-linked** (podspec) so the app still launches on
  iOS < 26.

Runs on a real device only (the API is unavailable in the Simulator).
