import { Image } from "expo-image";
import { Image as ImageIcon, Music, Users } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Height each stacked chip reserves (used by the viewer to stack them). */
export const STORY_CHIP_STACK = 40;

function ChipFrame({
  children,
  style,
  pointerEvents
}: {
  children: ReactNode;
  style?: object;
  pointerEvents?: "none" | "auto";
}) {
  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space[1] + 2,
          paddingVertical: space[1] + 2,
          paddingHorizontal: space[3],
          borderRadius: radius.pill,
          backgroundColor: tokens.bg.scrim
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

/** Reshared post credit — opens the original. */
export function ViewPostChip({ onPress, style }: { onPress: () => void; style?: object }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel="View the original post" style={style}>
      <ChipFrame>
        <ImageIcon size={13} color={colors.white} strokeWidth={icon.stroke.regular} />
        <Text variant="label" className="text-white">
          View post
        </Text>
      </ChipFrame>
    </Pressable>
  );
}

/** "with @a @b" — each handle opens a profile. */
export function TagsChip({
  tags,
  onOpenUser,
  style
}: {
  tags: { userId: string; username: string }[];
  onOpenUser: (username: string) => void;
  style?: object;
}) {
  return (
    <ChipFrame style={[{ flexWrap: "wrap", maxWidth: "80%" }, style]}>
      <Users size={13} color={colors.white} strokeWidth={icon.stroke.regular} />
      <Text variant="label" className="text-mist">
        with
      </Text>
      {tags.map((tag) => (
        <Pressable
          key={tag.userId}
          onPress={() => onOpenUser(tag.username)}
          accessibilityLabel={`Open @${tag.username}'s profile`}
        >
          <Text variant="label" className="font-sansBold text-white">
            @{tag.username}
          </Text>
        </Pressable>
      ))}
    </ChipFrame>
  );
}

/** What's playing on this story. */
export function MusicChipOverlay({
  music,
  style
}: {
  music: { title: string; artist: string; artworkUrl?: string | null };
  style?: object;
}) {
  return (
    <ChipFrame pointerEvents="none" style={[{ paddingLeft: space[1] + 2 }, style]}>
      {music.artworkUrl ? (
        <Image
          source={{ uri: music.artworkUrl }}
          style={{ width: 22, height: 22, borderRadius: 6 }}
          contentFit="cover"
        />
      ) : (
        <Music size={14} color={colors.white} strokeWidth={icon.stroke.regular} />
      )}
      <Text variant="mono" numberOfLines={1} className="max-w-[220px] text-white">
        {music.title} · {music.artist}
      </Text>
    </ChipFrame>
  );
}
