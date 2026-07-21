import { useEffect, useRef } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, Easing } from "react-native-reanimated";

import { useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { durations } from "@/theme/motion";

/**
 * Full-screen white capture flash per spec §6.1: opacity → 0.9 over 90ms linear,
 * fully off ~150ms. Mount once in the root layout (above everything); trigger
 * imperatively via `useUiStore.getState().flash()` / `triggerFlash()`.
 */
export function FlashOverlay() {
  const flashSignal = useUiStore((state) => state.flashSignal);
  const opacity = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.value = 0;
    opacity.value = withSequence(
      withTiming(0.9, { duration: durations.flashIn, easing: Easing.linear }),
      withTiming(0, { duration: durations.flashTotal - durations.flashIn, easing: Easing.linear })
    );
  }, [flashSignal, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.pure,
          zIndex: 9999
        },
        style
      ]}
    />
  );
}
