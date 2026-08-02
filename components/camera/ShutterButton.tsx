import { Lock } from "lucide-react-native";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { Pressable } from "@/components/ui/Pressable";
import { selectionHaptic } from "@/lib/haptics";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

const RING = 76;
const STROKE = 4;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Gold arc around the button showing recording progress toward max duration. */
function ProgressRing({ progress }: { progress: number }) {
  return (
    <Svg width={RING} height={RING} style={{ position: "absolute" }}>
      <Circle
        cx={RING / 2}
        cy={RING / 2}
        r={R}
        stroke={tokens.accent.gold}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(1, progress)))}
        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
      />
    </Svg>
  );
}

/** Slide this far left (px) onto the lock to keep recording hands-free. */
const LOCK_DISTANCE = 74;

/**
 * Snapchat-style capture button:
 *  - tap        → photo (onTap)
 *  - press-hold → starts recording video (onStartRecording); release stops it
 *  - slide left onto the lock icon → hands-free recording (onLock); the button
 *    then becomes a tap-to-stop control (onStopRecording)
 */
export function ShutterButton({
  recording,
  locked,
  disabled = false,
  allowRecording = true,
  progress = 0,
  onTap,
  onStartRecording,
  onStopRecording,
  onLock,
  onZoomDelta
}: {
  recording: boolean;
  locked: boolean;
  disabled?: boolean;
  /** Disable the hold gesture for photo-only capture modes. */
  allowRecording?: boolean;
  /** Recording progress 0–1 (elapsed / max duration) for the gold ring. */
  progress?: number;
  onTap: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onLock: () => void;
  /** Vertical finger travel while holding → zoom (negative dy = up = zoom in). */
  onZoomDelta?: (dy: number) => void;
}) {
  // 0 → not locked this drag, 1 → crossed the lock threshold (UI-thread flag).
  const lockedSV = useSharedValue(0);
  const dragX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const active = useSharedValue(0);

  const tap = Gesture.Tap()
    .enabled(!disabled && !recording)
    .maxDuration(260)
    // Haptic on touch-down so capture feels instant even though the photo fires
    // on release (release = the tap-vs-hold disambiguation point).
    .onBegin(() => runOnJS(selectionHaptic)())
    .onEnd(() => runOnJS(onTap)());

  const hold = Gesture.Pan()
    .enabled(!disabled && !locked && allowRecording)
    .activateAfterLongPress(240)
    .onStart(() => {
      lockedSV.value = 0;
      dragX.value = 0;
      lastY.value = 0;
      active.value = withTiming(1, { duration: 140 });
      runOnJS(onStartRecording)();
    })
    .onUpdate((e) => {
      // Leftward travel → toward the lock; clamp so the puck sits on the lock.
      dragX.value = Math.max(-LOCK_DISTANCE, Math.min(0, e.translationX));
      if (e.translationX <= -LOCK_DISTANCE && lockedSV.value === 0) {
        lockedSV.value = 1;
        runOnJS(onLock)();
      }
      // Vertical travel → zoom (#6): report the incremental change so the parent
      // integrates it. Only while not yet locked (finger still on the button).
      if (lockedSV.value === 0 && onZoomDelta) {
        const dy = e.translationY - lastY.value;
        lastY.value = e.translationY;
        runOnJS(onZoomDelta)(dy);
      }
    })
    .onEnd(() => {
      active.value = withTiming(0, { duration: 140 });
      dragX.value = withTiming(0, { duration: 120 });
      if (lockedSV.value === 0) runOnJS(onStopRecording)();
    });

  const composed = Gesture.Exclusive(hold, tap);

  const puckStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));
  const lockHintStyle = useAnimatedStyle(() => ({
    opacity: active.value * (1 - lockedSV.value),
    transform: [{ scale: 0.8 + 0.2 * Math.min(1, -dragX.value / LOCK_DISTANCE) }]
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Lock target to the left of the button, revealed while recording. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: "50%",
            marginLeft: -(LOCK_DISTANCE + 22),
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            borderWidth: 1,
            borderColor: colors.slate
          },
          lockHintStyle
        ]}
      >
        <Lock size={18} color={colors.white} strokeWidth={2.2} />
      </Animated.View>

      {locked ? (
        // Locked: recording continues hands-free — tap to stop.
        <Pressable onPress={onStopRecording} accessibilityRole="button" accessibilityLabel="Stop recording">
          <View>
            {recording ? <ProgressRing progress={progress} /> : null}
            <ShutterRing recording locked />
          </View>
        </Pressable>
      ) : (
        <GestureDetector gesture={composed}>
          {/* Generous hit area (16px all sides) so grazes register. */}
          <Animated.View style={[{ padding: 16 }, puckStyle]}>
            {recording ? <ProgressRing progress={progress} /> : null}
            <ShutterRing recording={recording} locked={false} />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

/** The visual ring: white puck idle, red puck recording, red square when locked. */
function ShutterRing({ recording, locked }: { recording: boolean; locked: boolean }) {
  const inner = locked
    ? { width: 30, height: 30, borderRadius: 8, backgroundColor: "#EF4444" }
    : recording
      ? { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EF4444" }
      : { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white };
  return (
    <View
      style={{
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: recording ? "#EF4444" : colors.white,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <View style={inner} />
    </View>
  );
}
