import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

/**
 * Subtle animated glint that sweeps across a Diamond-tier surface every few
 * seconds (spec: "icy shimmer/foil treatment… subtle animated glint"). Absolute
 * overlay — parent needs overflow hidden. Static in reduced-motion mode.
 */
export function DiamondGlint({ width, height }: { width: number; height: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-width);
  useEffect(() => {
    if (reduced) return;
    x.value = withRepeat(
      withSequence(
        withTiming(width * 1.5, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withDelay(2600, withTiming(-width, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [reduced, width, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: "18deg" }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: -height * 0.3, left: 0, width: width * 0.45, height: height * 1.6 }, style]}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(155,231,255,0.35)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
