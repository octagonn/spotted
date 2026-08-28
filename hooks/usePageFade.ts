import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

/**
 * Sequenced page fades for the auth/onboarding flow. Screens render over the
 * shared ambient video background (mounted in the root layout) with navigator
 * animations disabled — each screen fades its own content fully OUT before
 * navigating, and fades IN whenever it gains focus. The two fades never
 * overlap, and the background never moves.
 *
 * Usage:
 *   const { fadeStyle, fadeNavigate } = usePageFade();
 *   <Animated.View style={[{ flex: 1 }, fadeStyle]}>…</Animated.View>
 *   <Button onPress={() => fadeNavigate(() => router.push("/next"))} />
 */
export function usePageFade() {
  const opacity = useSharedValue(0);
  const leaving = useRef(false);

  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      return () => {
        // Rest hidden while covered so any return to this screen fades in.
        opacity.value = 0;
      };
    }, [opacity])
  );

  const fadeNavigate = useCallback(
    (action: () => void) => {
      if (leaving.current) return;
      leaving.current = true;
      opacity.value = withTiming(
        0,
        { duration: 180, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(action)();
        }
      );
    },
    [opacity]
  );

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return { fadeStyle, fadeNavigate };
}
