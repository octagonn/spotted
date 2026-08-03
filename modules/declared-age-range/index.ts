import { Platform } from "react-native";

/**
 * JS wrapper for the Declared Age Range native module (iOS 26+ only).
 *
 * NATIVE SIDE CURRENTLY DEFERRED (see README.md): the Swift module is removed,
 * so requireNativeModule() throws and this resolves { status: "unavailable" }
 * everywhere — the birthday screen then falls back to the DOB age gate. Safe on
 * Android, older iOS, Expo Go, and web regardless. Restoring the native module
 * makes this light up again with no changes here.
 */

export type DeclaredAgeRangeResult =
  | { status: "shared"; lowerBound?: number; upperBound?: number }
  | { status: "declined" }
  | { status: "unavailable" }
  | { status: "error"; message?: string };

export async function requestDeclaredAgeRange(): Promise<DeclaredAgeRangeResult> {
  if (Platform.OS !== "ios") return { status: "unavailable" };
  try {
    const { requireNativeModule } = await import("expo-modules-core");
    const native = requireNativeModule<{
      requestAgeRange(): Promise<DeclaredAgeRangeResult>;
    }>("DeclaredAgeRange");
    return await native.requestAgeRange();
  } catch {
    // Not compiled into this binary (Expo Go / old build) — degrade quietly.
    return { status: "unavailable" };
  }
}
