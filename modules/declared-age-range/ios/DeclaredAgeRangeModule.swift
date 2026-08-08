import ExpoModulesCore
import UIKit
#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

/**
 * Bridge to Apple's Declared Age Range API (iOS 26+).
 *
 * requestAgeRange() presents the system sheet asking the user (or, for a
 * child account, applying the parent/guardian-declared range) to share an age
 * range with the app, using our 13/16/18 age gates. Resolves to:
 *   { status: "shared", lowerBound?: number, upperBound?: number }
 *   { status: "declined" }      user chose not to share
 *   { status: "unavailable" }   iOS < 26.2, framework/API absent, or no scene
 *   { status: "error", message }
 *
 * The JS side treats declined/unavailable gracefully (falls back to the
 * date-of-birth gate) — per Apple guidance, declining must not punish.
 *
 * Verified against Apple's DeclaredAgeRange docs:
 *   AgeRangeService.shared.requestAgeRange(ageGates: Int, _: Int?, _: Int?, in: UIViewController)
 *     async throws -> AgeRangeService.Response
 *   Response: .sharing(range: AgeRange) | .declinedSharing
 *   AgeRange: lowerBound: Int?, upperBound: Int?
 */
public class DeclaredAgeRangeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeclaredAgeRange")

    AsyncFunction("requestAgeRange") { (promise: Promise) in
      #if canImport(DeclaredAgeRange)
      // Guard at 26.2 (the first SDK where AgeRangeService is finalized) so the
      // call compiles regardless of whether the symbol is annotated 26.0 or
      // 26.2; older OSes fall through to "unavailable".
      if #available(iOS 26.2, *) {
        Task { @MainActor in
          guard let presenter = Self.topViewController() else {
            promise.resolve(["status": "unavailable"])
            return
          }
          do {
            // ageGates: first required, then two optional thresholds → 13/16/18.
            let response = try await AgeRangeService.shared.requestAgeRange(
              ageGates: 13, 16, 18, in: presenter
            )
            switch response {
            case .sharing(let range):
              var result: [String: Any] = ["status": "shared"]
              if let lower = range.lowerBound { result["lowerBound"] = lower }
              if let upper = range.upperBound { result["upperBound"] = upper }
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

  /// Topmost view controller of the foreground scene, to present the sheet from.
  @MainActor
  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    var controller =
      scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
      ?? scene?.windows.first?.rootViewController
    while let presented = controller?.presentedViewController {
      controller = presented
    }
    return controller
  }
}
