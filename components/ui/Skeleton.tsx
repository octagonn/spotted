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

/**
 * List row placeholder: avatar circle + two text bars. The workhorse for
 * people/inbox/members/requests lists. `avatar={0}` drops the circle (e.g.
 * gym-search rows that have no avatar).
 */
export function SkeletonRow({
  avatar = 40,
  lines = 2,
  style
}: {
  avatar?: number;
  lines?: 1 | 2;
  style?: object;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10 }, style]}>
      {avatar > 0 ? <Skeleton width={avatar} height={avatar} radius={avatar / 2} /> : null}
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="55%" height={12} />
        {lines > 1 ? <Skeleton width="35%" height={10} /> : null}
      </View>
    </View>
  );
}

/** n× SkeletonRow — the common "list is loading" block. */
export function SkeletonRows({ count = 4, avatar = 40, style }: { count?: number; avatar?: number; style?: object }) {
  return (
    <View style={style}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} avatar={avatar} />
      ))}
    </View>
  );
}

/** 3-column photo-grid placeholder (profile grids, tagged, archives). */
export function SkeletonGrid({ count = 9, aspectRatio = 4 / 5 }: { count?: number; aspectRatio?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: "33.333%", aspectRatio, padding: 1 }}>
          <Skeleton width="100%" radius={2} style={{ flex: 1, height: undefined }} />
        </View>
      ))}
    </View>
  );
}

/** Chat-thread placeholder: alternating left/right bubbles of varied width. */
export function SkeletonChatBubbles({ count = 6 }: { count?: number }) {
  const widths = ["55%", "70%", "45%", "62%", "50%", "68%"] as const;
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ alignItems: i % 2 === 0 ? "flex-start" : "flex-end" }}>
          <Skeleton width={widths[i % widths.length]} height={36} radius={18} />
        </View>
      ))}
    </View>
  );
}

/** Workout summary row: icon square + title/meta bars + right-side stat. */
export function SkeletonWorkoutRow() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 18, paddingVertical: 10 }}>
      <Skeleton width={44} height={44} radius={13} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="45%" height={13} />
        <Skeleton width="60%" height={10} />
      </View>
      <Skeleton width={34} height={16} />
    </View>
  );
}

/** Settings toggle rows: label bar + pill switch. */
export function SkeletonToggleRows({ count = 8 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 }}>
          <Skeleton width={`${45 + (i % 3) * 12}%` as `${number}%`} height={13} />
          <Skeleton width={44} height={26} radius={13} />
        </View>
      ))}
    </View>
  );
}

/** Detail-screen header: square photo/icon + title bars (community, workout). */
export function SkeletonHeaderDetail() {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Skeleton width={68} height={68} radius={16} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={11} />
        </View>
      </View>
    </View>
  );
}

/** Moderation review card: full-width media block + meta bars. */
export function SkeletonMediaCard() {
  return (
    <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 10 }}>
      <Skeleton width="100%" radius={12} style={{ aspectRatio: 3 / 3.6 }} />
      <Skeleton width="50%" height={12} />
      <Skeleton width="30%" height={10} />
    </View>
  );
}

/** Comment row: small avatar + text bars (indent for replies). */
export function SkeletonCommentRow({ indent = 0 }: { indent?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingLeft: 18 + indent, paddingRight: 18, paddingVertical: 8 }}>
      <Skeleton width={28} height={28} radius={14} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="30%" height={10} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

/** Music track row: artwork square + title/artist bars. */
export function SkeletonTrackRow() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 9 }}>
      <Skeleton width={42} height={42} radius={8} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="50%" height={12} />
        <Skeleton width="35%" height={10} />
      </View>
    </View>
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
