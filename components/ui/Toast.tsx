import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { durations, easing } from "@/theme/motion";

const NAV_H = 84;

/**
 * Toast host per spec §2.10: white pill bottom-center at nav-h + 22px; text
 * black 600/13; fade + 16px rise over 220ms; 2100ms dwell. Mount once in the
 * root layout; enqueue via `useUiStore.getState().show(message)` / `showToast()`.
 */
export function ToastHost() {
  const toast = useUiStore((state) => state.toasts[0]);
  const dismissToast = useUiStore((state) => state.dismissToast);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const id = toast.id;
    progress.value = 0;
    progress.value = withSequence(
      withTiming(1, { duration: durations.toast, easing: easing.standard }),
      withDelay(
        durations.toastDwell,
        withTiming(0, { duration: durations.toast, easing: easing.standard }, (finished) => {
          if (finished) {
            runOnJS(dismissToast)(id);
          }
        })
      )
    );
  }, [toast, dismissToast, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }]
  }));

  if (!toast) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: NAV_H + 22 + insets.bottom,
        alignItems: "center"
      }}
    >
      <Animated.View
        style={[
          {
            backgroundColor: colors.white,
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 18
          },
          animatedStyle
        ]}
      >
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.black }}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}
