import { usePathname } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, makeMutable, useAnimatedStyle } from "react-native-reanimated";
import { create } from "zustand";

import { CachedImage } from "@/components/ui/CachedImage";

/**
 * Instagram-style zoom: when a post photo is pinched, a copy of the image is
 * rendered HERE — at the app root, above navigation — so the zoom covers the
 * whole screen instead of being painted over by the caption, neighboring
 * cards, and the tab bar. A dimming backdrop fades in with the zoom.
 *
 * MediaFrame drives the shared transform values below during the pinch and
 * shows/hides the preview through the store; this host is purely visual
 * (pointerEvents none) so gestures keep flowing to the post underneath.
 */

export const zoomScale = makeMutable(1);
export const zoomTx = makeMutable(0);
export const zoomTy = makeMutable(0);

export type ZoomRect = { x: number; y: number; width: number; height: number };

type ZoomPreviewState = {
  uri: string | null;
  rect: ZoomRect | null;
  show: (uri: string, rect: ZoomRect) => void;
  hide: () => void;
};

export const useZoomPreview = create<ZoomPreviewState>((set) => ({
  uri: null,
  rect: null,
  show: (uri, rect) => set({ uri, rect }),
  hide: () => set({ uri: null, rect: null })
}));

export function ZoomPreviewHost() {
  const uri = useZoomPreview((state) => state.uri);
  const rect = useZoomPreview((state) => state.rect);
  const pathname = usePathname();

  // A zoom preview never legitimately outlives the screen it started on —
  // clear any stray overlay (e.g. from a race that showed it after its hide)
  // whenever navigation happens.
  useEffect(() => {
    useZoomPreview.getState().hide();
    zoomScale.value = 1;
    zoomTx.value = 0;
    zoomTy.value = 0;
  }, [pathname]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(zoomScale.value, [1, 1.8], [0, 0.92], Extrapolation.CLAMP)
  }));
  const mediaStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zoomTx.value }, { translateY: zoomTy.value }, { scale: zoomScale.value }]
  }));

  if (!uri || !rect) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, backdropStyle]} />
      <Animated.View
        style={[
          { position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height },
          mediaStyle
        ]}
      >
        <CachedImage source={{ uri }} contentFit="cover" style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
