import { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors } from "@/theme/colors";

/** A single shimmering placeholder block. */
export function Skeleton({
  width = "100%",
  height,
  radius = 8,
  style
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}) {
  const shimmer = useSharedValue(0.4);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [shimmer]);
  const animated = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.graphite }, animated, style]} />
  );
}

/** A feed post placeholder (header + media + caption lines). */
export function PostCardSkeleton() {
  return (
    <View style={{ paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 10 }}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={{ gap: 6 }}>
          <Skeleton width={120} height={12} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <Skeleton width="100%" radius={0} style={{ aspectRatio: 3 / 3.6 }} />
      <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 8 }}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="45%" height={12} />
      </View>
    </View>
  );
}
