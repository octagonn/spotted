import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { colors } from "@/theme/colors";

/**
 * Smooth, continuous clip-start scrubber. The knob and highlight are driven on
 * the UI thread (no per-frame React re-render), so dragging is fluid instead of
 * snapping in 1-second steps. The parent is told the integer second only when
 * it changes (for the label) and once more on release (to save).
 */
export function MusicClipScrubber({
  previewSeconds,
  maxStart,
  initialStart,
  onChange,
  onCommit
}: {
  previewSeconds: number;
  /** Latest second the clip may start at (so the window stays inside the preview). */
  maxStart: number;
  initialStart: number;
  onChange: (seconds: number) => void;
  onCommit: (seconds: number) => void;
}) {
  const [barW, setBarW] = useState(0);
  // Fraction 0–1 of the FULL preview width where the knob sits.
  const knob = useSharedValue(previewSeconds > 0 ? initialStart / previewSeconds : 0);
  const lastSec = useSharedValue(initialStart);

  const report = (frac: number, commit: boolean) => {
    const sec = Math.round(Math.max(0, Math.min(maxStart, frac * previewSeconds)));
    onChange(sec);
    if (commit) onCommit(sec);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (!barW) return;
      const frac = Math.max(0, Math.min(maxStart / previewSeconds, e.x / barW));
      knob.value = frac;
    })
    .onUpdate((e) => {
      if (!barW) return;
      const frac = Math.max(0, Math.min(maxStart / previewSeconds, e.x / barW));
      knob.value = frac;
      const sec = Math.round(frac * previewSeconds);
      if (sec !== lastSec.value) {
        lastSec.value = sec;
        runOnJS(report)(frac, false);
      }
    })
    .onEnd(() => {
      runOnJS(report)(knob.value, true);
    });

  const highlightStyle = useAnimatedStyle(() => ({ left: `${knob.value * 100}%` }));
  const knobStyle = useAnimatedStyle(() => ({ left: `${knob.value * 100}%` }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
        style={{ marginTop: 12, height: 30, justifyContent: "center" }}
      >
        <View style={{ height: 5, borderRadius: 2.5, backgroundColor: colors.iron }} />
        {/* Kept window: from the knob to the end of the preview. */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", right: 0, height: 5, borderRadius: 2.5, backgroundColor: colors.silver }, highlightStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white }, knobStyle]}
        />
      </View>
    </GestureDetector>
  );
}
