import { useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { colors } from "@/theme/colors";

/**
 * Smooth, continuous clip-start scrubber. The knob and highlight are driven on
 * the UI thread (no per-frame React re-render), so dragging is fluid instead of
 * snapping in 1-second steps. The parent is told the integer second only when
 * it changes (for the label) and once more on release (to save).
 *
 * CRASH NOTE — why everything below is memoized:
 * reporting each new second re-renders the PARENT (it owns clipStart), which
 * re-renders this component. The gesture used to be built inline with
 * `Gesture.Pan()` on every render, which handed GestureDetector a brand-new
 * gesture object ~25 times *during an active drag*, forcing gesture-handler to
 * tear down and reattach the native handler mid-gesture — and that crashed the
 * app the moment you dragged the music slider (posts and stories alike, since
 * both go through this one picker). The gesture is now built ONCE: callbacks
 * live in a ref, geometry lives in shared values, and the useMemo below has
 * only stable dependencies.
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
  // Fraction 0–1 of the FULL preview width where the knob sits.
  const knob = useSharedValue(previewSeconds > 0 ? initialStart / previewSeconds : 0);
  const lastSec = useSharedValue(initialStart);
  // Geometry the gesture worklet needs. Held as shared values (not React
  // state) so the worklet never closes over anything that changes identity.
  const barW = useSharedValue(0);
  const totalSec = useSharedValue(previewSeconds);
  const maxFrac = useSharedValue(previewSeconds > 0 ? Math.min(1, maxStart / previewSeconds) : 0);

  useEffect(() => {
    totalSec.value = previewSeconds;
    maxFrac.value = previewSeconds > 0 ? Math.min(1, maxStart / previewSeconds) : 0;
  }, [maxStart, previewSeconds, totalSec, maxFrac]);

  // Latest props reachable from a stable callback, so the gesture never has to
  // be rebuilt just because the parent re-rendered.
  const latest = useRef({ onChange, onCommit, previewSeconds, maxStart });
  latest.current = { onChange, onCommit, previewSeconds, maxStart };

  const report = useCallback((frac: number, commit: boolean) => {
    const { onChange: change, onCommit: commitCb, previewSeconds: total, maxStart: max } = latest.current;
    if (!(total > 0)) return;
    const sec = Math.round(Math.max(0, Math.min(max, frac * total)));
    change(sec);
    if (commit) commitCb(sec);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          if (!barW.value) return;
          knob.value = Math.max(0, Math.min(maxFrac.value, e.x / barW.value));
        })
        .onUpdate((e) => {
          if (!barW.value) return;
          const frac = Math.max(0, Math.min(maxFrac.value, e.x / barW.value));
          knob.value = frac;
          // Only cross into JS when the whole second changes — the knob itself
          // is already animating on the UI thread, so this is just the label.
          const sec = Math.round(frac * totalSec.value);
          if (sec !== lastSec.value) {
            lastSec.value = sec;
            runOnJS(report)(frac, false);
          }
        })
        .onEnd(() => {
          runOnJS(report)(knob.value, true);
        }),
    // All stable: shared values keep their identity for the component's life,
    // and `report` is a no-dependency useCallback. The gesture is built once.
    [barW, knob, lastSec, maxFrac, totalSec, report]
  );

  const highlightStyle = useAnimatedStyle(() => ({ left: `${knob.value * 100}%` }));
  const knobStyle = useAnimatedStyle(() => ({ left: `${knob.value * 100}%` }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => {
          barW.value = e.nativeEvent.layout.width;
        }}
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
