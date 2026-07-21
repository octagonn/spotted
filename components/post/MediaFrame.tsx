import { Heart } from "lucide-react-native";
import { useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { colors } from "@/theme/colors";

/**
 * Wraps post media with Instagram-style gestures:
 *  - pinch to zoom + pan while pinching; springs back on release
 *  - double-tap to like, with a heart-burst animation
 * Disabled entirely when `locked` (frosted feed).
 */
export function MediaFrame({
  children,
  locked = false,
  onLike,
  onSingleTap
}: {
  children: React.ReactNode;
  locked?: boolean;
  /** Called on double-tap. Return handled synchronously; the burst always plays. */
  onLike?: () => void;
  /** Optional single-tap action (e.g. video mute) — waits for the double-tap
   *  window so it never races the like. */
  onSingleTap?: () => void;
}) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const heart = useSharedValue(0);
  const lastLike = useRef(0);

  const pinch = Gesture.Pinch()
    .enabled(!locked)
    .onStart((e) => {
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(4, e.scale));
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 20, stiffness: 240 });
      tx.value = withSpring(0);
      ty.value = withSpring(0);
    });

  const pan = Gesture.Pan()
    .enabled(!locked)
    .minPointers(2)
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = e.translationX;
        ty.value = e.translationY;
      }
    })
    .onEnd(() => {
      tx.value = withSpring(0);
      ty.value = withSpring(0);
    });

  const fireLike = () => {
    const now = Date.now();
    if (now - lastLike.current > 600) {
      lastLike.current = now;
      onLike?.();
    }
  };

  const doubleTap = Gesture.Tap()
    .enabled(!locked)
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((_event, success) => {
      if (!success) return;
      heart.value = 0;
      heart.value = withTiming(1, { duration: 180 }, () => {
        heart.value = withTiming(0, { duration: 320 });
      });
      runOnJS(fireLike)();
    });

  const fireSingleTap = () => onSingleTap?.();

  // Single tap defers to the double-tap window (Exclusive) — mute toggles on
  // videos can't steal the like anymore.
  const singleTap = Gesture.Tap()
    .enabled(!locked)
    .numberOfTaps(1)
    .onEnd((_event, success) => {
      if (success) runOnJS(fireSingleTap)();
    });

  const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const mediaStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value }
    ]
  }));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heart.value,
    transform: [{ scale: 0.6 + heart.value * 0.9 }]
  }));

  return (
    <GestureDetector gesture={composed}>
      <View>
        <Animated.View style={mediaStyle}>{children}</Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }, heartStyle]}>
          <Heart size={96} color={colors.white} fill={colors.white} strokeWidth={0} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
