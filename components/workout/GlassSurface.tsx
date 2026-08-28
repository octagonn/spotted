import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";

// Apple's real Liquid Glass (iOS 26 UIGlassEffect) via expo-glass-effect —
// lazy-required AND capability-probed inside try/catch, same pattern as the
// tab bar: in Expo Go or builds made before the module existed, either the
// require or the availability call throws — both must fall back to BlurView.
let Glass: typeof import("expo-glass-effect") | null = null;
let liquidGlassAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Glass = require("expo-glass-effect");
  liquidGlassAvailable = Glass?.isLiquidGlassAvailable() ?? false;
} catch {
  Glass = null;
  liquidGlassAvailable = false;
}

/**
 * Floating glass container for the workout screen (bottom bar, rest pill) —
 * the same material language as the tab bar. The native effect view must not
 * own the content layout (it doesn't reliably forward flex styles), so
 * children are always wrapped in a plain View by the caller.
 */
export function GlassSurface({
  children,
  radius = 28,
  style
}: {
  children: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          shadowColor: "#000000",
          shadowOpacity: 0.5,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14
        },
        style
      ]}
    >
      {Glass && liquidGlassAvailable ? (
        <Glass.GlassView
          glassEffectStyle="regular"
          isInteractive
          style={{ borderRadius: radius, overflow: "hidden" }}
        >
          {children}
        </Glass.GlassView>
      ) : (
        <View
          style={{
            borderRadius: radius,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)"
          }}
        >
          <BlurView
            intensity={100}
            tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
            style={{
              backgroundColor: Platform.OS === "ios" ? "rgba(14,14,18,0.08)" : "rgba(16,16,20,0.6)"
            }}
          >
            {/* Top-edge sheen — the light catching the glass. */}
            <LinearGradient
              colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.02)", "transparent"]}
              locations={[0, 0.35, 1]}
              pointerEvents="none"
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 26 }}
            />
            {children}
          </BlurView>
        </View>
      )}
    </View>
  );
}
