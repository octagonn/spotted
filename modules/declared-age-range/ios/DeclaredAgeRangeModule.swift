import ExpoModulesCore
#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

/**
 * Bridge to Apple's Declared Age Range API (iOS 26+).
 *
 * requestAgeRange() presents the system sheet asking the user (or, for child
 * accounts, applying the parent-declared range) to share an age range with the
 * app. Resolves to one of:
 *   { status: "shared", lowerBound?: number, upperBound?: number }
 *   { status: "declined" }      user chose not to share
 *   { status: "unavailable" }   iOS < 26 / framework missing / no scene
 *   { status: "error", message }
 *
 * The app treats "declined"/"unavailable" gracefully (falls back to the
 * date-of-birth screen) — per Apple guidance, declining must not punish.
 */
public class DeclaredAgeRangeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeclaredAgeRange")

    AsyncFunction("requestAgeRange") { (promise: Promise) in
      #if canImport(DeclaredAgeRange)
      if #available(iOS 26.0, *) {
        Task { @MainActor in
          do {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else {
              promise.resolve(["status": "unavailable"])
              return
            }
            // Age gates mirror the app's policy tiers (13 minimum).
            let response = try await AgeRangeService.shared.requestAgeRange(ageGates: 13, 16, 18, in: scene)
            switch response {
            case .sharing(let declaration):
              var result: [String: Any] = ["status": "shared"]
              if let lower = declaration.lowerBound { result["lowerBound"] = lower }
              if let upper = declaration.upperBound { result["upperBound"] = upper }
              promise.resolve(result)
            case .declinedSharing:
              promise.resolve(["status": "declined"])
            @unknown default:
              promise.resolve(["status": "unavailable"])
            }
          } catch {
            promise.resolve(["status": "error", "message": error.localizedDescription])
          }
        }
        return
      }
      #endif
      promise.resolve(["status": "unavailable"])
    }
  }
}
