import { Heart } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { useZoomPreview, zoomScale, zoomTx, zoomTy } from "@/components/post/ZoomPreviewHost";
import { colors } from "@/theme/colors";

/**
 * Wraps post media with Instagram-style gestures:
 *  - pinch to zoom + pan while pinching; springs back on release
 *  - double-tap to like, with a heart-burst animation
 * Disabled entirely when `locked` (frosted feed).
 *
 * When `zoomUri` is provided (plain photo posts), the pinch drives the ROOT
 * ZoomPreviewHost instead of transforming in place: a copy of the photo is
 * rendered above the whole app with a dimming backdrop, so the zoom covers
 * the screen (IG behavior) instead of being painted over by the caption and
 * neighboring cards — and the dual-camera inset disappears under it.
 */
export function MediaFrame({
  children,
  locked = false,
  zoomUri = null,
  onLike,
  onSingleTap
}: {
  children: React.ReactNode;
  locked?: boolean;
  /** Plain photo URL to preview full-screen while pinching. Omit for videos /
   *  carousels / stacks — those keep the in-place transform. */
  zoomUri?: string | null;
  /** Called on double-tap. Return handled synchronously; the burst always plays. */
  onLike?: () => void;
  /** Optional single-tap action (e.g. video mute) — waits for the double-tap
   *  window so it never races the like. */
  onSingleTap?: () => void;
}) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const heart = useSharedValue(0);
  const lastLike = useRef(0);
  const frameRef = useRef<View>(null);
  const useOverlay = Boolean(zoomUri);

  // True from pinch start until finalize. measureInWindow's callback lands
  // async: a fast pinch can finish (and hide) BEFORE the measure returns, and
  // showing then would strand the overlay above the app with nothing left to
  // hide it (it's invisible while aligned at scale 1, then "sticks" over the
  // next screen after navigating).
  const pinchActive = useRef(false);

  const beginZoom = () => {
    if (!zoomUri) return;
    pinchActive.current = true;
    frameRef.current?.measureInWindow((x, y, width, height) => {
      if (!pinchActive.current) return;
      if (width > 0 && height > 0) {
        useZoomPreview.getState().show(zoomUri, { x, y, width, height });
      }
    });
  };

  const markPinchEnded = () => {
    pinchActive.current = false;
  };

  const endZoom = () => {
    pinchActive.current = false;
    useZoomPreview.getState().hide();
  };

  const pinch = Gesture.Pinch()
    .enabled(!locked)
    .onStart(() => {
      if (useOverlay) {
        zoomScale.value = 1;
        zoomTx.value = 0;
        zoomTy.value = 0;
        runOnJS(beginZoom)();
      }
    })
    .onUpdate((e) => {
      const next = Math.max(1, Math.min(4, e.scale));
      if (useOverlay) zoomScale.value = next;
      else scale.value = next;
    })
    // onFinalize, NOT onEnd: onEnd never fires when the gesture is CANCELLED
    // (the list steals it, navigation happens mid-pinch) — the release spring
    // then never ran and the full-screen overlay stayed up, dimming the whole
    // app until a refresh. onFinalize runs on every way a gesture can stop.
    .onFinalize(() => {
      if (useOverlay) {
        // Stop a still-in-flight measure callback from re-showing the overlay
        // after this release already hid it.
        runOnJS(markPinchEnded)();
        zoomTx.value = withSpring(0);
        zoomTy.value = withSpring(0);
        // Hide even when the spring was interrupted (finished === false):
        // an interrupted close otherwise stranded the overlay too. A brand-new
        // pinch re-shows it in its own onStart, so over-hiding is harmless.
        zoomScale.value = withSpring(1, { damping: 20, stiffness: 240 }, () => {
          runOnJS(endZoom)();
        });
      } else {
        scale.value = withSpring(1, { damping: 20, stiffness: 240 });
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  const pan = Gesture.Pan()
    .enabled(!locked)
    .minPointers(2)
    .onUpdate((e) => {
      const zoomed = (useOverlay ? zoomScale.value : scale.value) > 1;
      if (!zoomed) return;
      if (useOverlay) {
        zoomTx.value = e.translationX;
        zoomTy.value = e.translationY;
      } else {
        tx.value = e.translationX;
        ty.value = e.translationY;
      }
    })
    .onFinalize(() => {
      if (useOverlay) {
        zoomTx.value = withSpring(0);
        zoomTy.value = withSpring(0);
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  // Last-resort cleanup: if this card unmounts (recycled, navigated away)
  // while it owns the preview, take the overlay down with it.
  useEffect(
    () => () => {
      if (zoomUri && useZoomPreview.getState().uri === zoomUri) {
        useZoomPreview.getState().hide();
        zoomScale.value = 1;
        zoomTx.value = 0;
        zoomTy.value = 0;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomUri]
  );

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

  // In-place transform only for media without an overlay preview.
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
      <View ref={frameRef} collapsable={false}>
        <Animated.View style={mediaStyle}>{children}</Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }, heartStyle]}>
          <Heart size={96} color={colors.white} fill={colors.white} strokeWidth={0} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
