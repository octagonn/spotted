import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { GlassSurface } from "@/components/workout/GlassSurface";
import { MED, NUM, W } from "@/components/workout/wtheme";
import { fmtClock } from "@/lib/workoutLibrary";

export const REST_SECONDS = 90;

/**
 * Rest countdown pill that appears after checking off a set — Liquid Glass
 * (tab-bar material), floating above the bottom bar. Tap anywhere to skip.
 * `signal` restarts the countdown each time it changes; 0 = hidden.
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
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(150)}>
      <GlassSurface radius={999}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rest, ${left} seconds left. Tap to skip`}
          onPress={onDone}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 11 }}
        >
          <Text style={{ fontFamily: MED, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: W.text }}>
            Rest
          </Text>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                borderRadius: 2,
                width: `${(left / REST_SECONDS) * 100}%`,
                backgroundColor: W.text
              }}
            />
          </View>
          <Text style={{ fontFamily: NUM, fontSize: 15, color: W.text }}>{fmtClock(left)}</Text>
          <Text style={{ fontFamily: MED, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
            Skip
          </Text>
        </Pressable>
      </GlassSurface>
    </Animated.View>
  );
}
