import { LinearGradient } from "expo-linear-gradient";
import { Lock, MoreHorizontal, X } from "lucide-react-native";
import { Pressable, View, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import type { StoryGroup } from "@/hooks/queries/useStories";
import { colors } from "@/theme/colors";
import { icon, space } from "@/theme/tokens";

/** Progress track over a photo — a story-only exception (hairline tokens are too faint on media). */
const TRACK = "rgba(255,255,255,0.3)";
const SCRIM_TOP = ["rgba(0,0,0,0.55)", "transparent"] as const;

type StoryHeaderProps = {
  group: StoryGroup;
  storyIndex: number;
  timeLabel: string;
  /** Animated width style for the active segment (driven by the viewer's timer). */
  activeBarStyle: AnimatedStyle<ViewStyle>;
  /** Hold-to-fullscreen: chrome fades out. */
  immersed: boolean;
  onOpenProfile: () => void;
  onOpenMenu: () => void;
  onClose: () => void;
};

/** Top scrim · progress segments · poster row (avatar, name, private badge, time, ⋯, ✕). */
export function StoryHeader({
  group,
  storyIndex,
  timeLabel,
  activeBarStyle,
  immersed,
  onOpenProfile,
  onOpenMenu,
  onClose
}: StoryHeaderProps) {
  const insets = useSafeAreaInsets();
  const opacity = immersed ? 0 : 1;
  return (
    <>
      <LinearGradient
        colors={[...SCRIM_TOP]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 110, opacity }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: insets.top + space[2],
          left: space[3],
          right: space[3],
          flexDirection: "row",
          gap: space[1],
          opacity
        }}
      >
        {group.stories.map((s, index) => (
          <View
            key={s.id}
            style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: TRACK, overflow: "hidden" }}
          >
            {index < storyIndex ? (
              <View style={{ height: "100%", width: "100%", backgroundColor: colors.white }} />
            ) : index === storyIndex ? (
              <Animated.View style={[{ height: "100%", backgroundColor: colors.white }, activeBarStyle]} />
            ) : null}
          </View>
        ))}
      </View>
      <View
        pointerEvents={immersed ? "none" : "auto"}
        style={{
          position: "absolute",
          top: insets.top + space[4] + 4,
          left: space[3] + 2,
          right: space[3] + 2,
          flexDirection: "row",
          alignItems: "center",
          gap: space[2] + 2,
          opacity
        }}
      >
        <Pressable
          onPress={onOpenProfile}
          disabled={group.isMe}
          accessibilityLabel={group.isMe ? "Your story" : `Open ${group.name}'s profile`}
          hitSlop={6}
          style={{ flexDirection: "row", alignItems: "center", gap: space[2] + 2 }}
        >
          <Avatar name={group.name} uri={group.avatarUrl} size={34} />
          <View>
            <Text variant="username" className="text-white">
              {group.name}
            </Text>
            {group.privateStoryName ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 1 }}>
                <Lock size={10} color={colors.mist} strokeWidth={icon.stroke.bold} />
                <Text variant="label" className="text-mist">
                  {group.privateStoryName}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Text variant="mono" className="text-silver">
          {timeLabel}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onOpenMenu}
          hitSlop={12}
          accessibilityLabel="Story options"
          style={{ paddingHorizontal: space[1] }}
        >
          <MoreHorizontal color={colors.white} size={icon.size.md} strokeWidth={icon.stroke.bold} />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close stories">
          <X color={colors.white} size={icon.size.md} strokeWidth={icon.stroke.bold} />
        </Pressable>
      </View>
    </>
  );
}
