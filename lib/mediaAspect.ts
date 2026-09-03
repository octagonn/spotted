import { useCallback, useEffect, useState } from "react";
import { Image } from "react-native";

import { clampPostRatio, DEFAULT_POST_RATIO } from "@/lib/postFrame";

// Ratio per uri, so recycled feed cards get the right frame height on first
// render instead of popping from the fallback after the image loads.
const ratioCache = new Map<string, number>();

/**
 * Frame ratio for FEED media (remote URLs): starts at the cached/fallback
 * ratio and settles from the rendering image's own onLoad dimensions — pass
 * `onSize` to ScenePhoto so no extra network fetch is ever made.
 */
export function usePostFrameRatio(
  uri: string | null | undefined,
  fallback: number = DEFAULT_POST_RATIO
): { ratio: number; onSize: (width: number, height: number) => void } {
  const [ratio, setRatio] = useState<number | null>(() => (uri ? (ratioCache.get(uri) ?? null) : null));
  useEffect(() => {
    setRatio(uri ? (ratioCache.get(uri) ?? null) : null);
  }, [uri]);
  const onSize = useCallback(
    (width: number, height: number) => {
      if (!uri || !(width > 0) || !(height > 0)) return;
      const next = clampPostRatio(width, height);
      ratioCache.set(uri, next);
      setRatio((current) => (current === next ? current : next));
    },
    [uri]
  );
  return { ratio: ratio ?? fallback, onSize };
}

/**
 * Frame ratio for LOCAL photos (file:// from the camera) — measured directly.
 * Don't use this for remote feed URLs: RN's Image.getSize would download the
 * image a second time next to expo-image's cache.
 */
export function usePhotoAspect(uri: string | null | undefined, fallback: number = DEFAULT_POST_RATIO): number {
  const [ratio, setRatio] = useState<number | null>(() => (uri ? (ratioCache.get(uri) ?? null) : null));
  useEffect(() => {
    if (!uri) {
      setRatio(null);
      return;
    }
    const cached = ratioCache.get(uri);
    if (cached) {
      setRatio(cached);
      return;
    }
    let alive = true;
    Image.getSize(
      uri,
      (width, height) => {
        const next = clampPostRatio(width, height);
        ratioCache.set(uri, next);
        if (alive) setRatio(next);
      },
      () => {
        // Unsizeable (bad uri) — keep the fallback frame.
      }
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  return ratio ?? fallback;
}
