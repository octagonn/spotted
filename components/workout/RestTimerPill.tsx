import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { GlassSurface } from "@/components/workout/GlassSurface";
import { colors } from "@/theme/colors";
import { fmtClock } from "@/lib/workoutLibrary";
import { durations } from "@/theme/motion";
import { radius, space, tokens } from "@/theme/tokens";

export const REST_SECONDS = 90;

/**
 * Rest countdown pill that appears after checking off a set — glass, floating
 * above the bottom bar. Tap anywhere to skip. `signal` restarts the countdown
 * each time it changes; 0 = hidden.
 */
export function RestTimerPill({ signal, onDone }: { signal: number; onDone: () => void }) {
  const [left, setLeft] = useState(REST_SECONDS);

  useEffect(() => {
    if (signal === 0) return;
    setLeft(REST_SECONDS);
    const t = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  if (signal === 0) return null;

  return (
    <Animated.View entering={FadeInDown.duration(durations.toast)} exiting={FadeOut.duration(durations.press)}>
      <GlassSurface radius={radius.pill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rest, ${left} seconds left. Tap to skip`}
          onPress={onDone}
          haptic="none"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            paddingHorizontal: space[4] + 2,
            paddingVertical: space[3] - 1
          }}
        >
          <Text variant="micro" className="text-white">
            Rest
          </Text>
          <View
            style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.hairlineStrong, overflow: "hidden" }}
          >
            <View
              style={{
                height: "100%",
                borderRadius: 2,
                width: `${(left / REST_SECONDS) * 100}%`,
                backgroundColor: tokens.text.primary
              }}
            />
          </View>
          <Text variant="numeral-sm">{fmtClock(left)}</Text>
          <Text variant="micro">Skip</Text>
        </Pressable>
      </GlassSurface>
    </Animated.View>
  );
}
