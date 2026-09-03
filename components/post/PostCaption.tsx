import { router } from "expo-router";
import { Flame, MapPin, Medal, Users } from "lucide-react-native";
import { View } from "react-native";

import { CtxChip } from "@/components/ui/Chips";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { splitMentions } from "@/lib/mentions";
import type { FeedCtxIcon, FeedMockPost } from "@/lib/redesignData";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

const CTX_ICONS: Record<FeedCtxIcon, typeof MapPin> = { pin: MapPin, users: Users, flame: Flame };

type PostCaptionProps = {
  post: Pick<FeedMockPost, "user" | "caption" | "taggedFriends" | "answeredCall" | "ctx">;
  locked?: boolean;
};

const openUser = (handle: string) => router.push(`/user/${handle.replace(/^@/, "")}`);

/**
 * Everything textual below the actions: "Answered the Call", public-feed
 * context chips, tagged friends, and the caption with live @mentions. Each
 * block is optional; spacing is a single 12pt step between blocks.
 */
export function PostCaption({ post, locked = false }: PostCaptionProps) {
  const dim = { opacity: locked ? 0.55 : 1 };
  const blocks: React.ReactNode[] = [];

  if (post.answeredCall) {
    blocks.push(
      <View key="call" style={{ flexDirection: "row", paddingHorizontal: space[4] }}>
        <Pressable onPress={() => !locked && openUser(post.answeredCall!)} haptic="none">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              borderRadius: radius.pill,
              backgroundColor: tokens.accent.goldSubtle,
              paddingVertical: space[1],
              paddingHorizontal: space[3]
            }}
          >
            <Medal size={12} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />
            <Text variant="label" className="text-gold">
              Answered the Call · @{post.answeredCall}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  if (post.ctx?.length) {
    blocks.push(
      <View key="ctx" style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], paddingHorizontal: space[4] }}>
        {post.ctx.map((chip) => {
          const Icon = CTX_ICONS[chip.icon];
          return (
            <CtxChip key={chip.label} icon={<Icon size={11} color={colors.silver} strokeWidth={icon.stroke.regular} />}>
              {chip.label}
            </CtxChip>
          );
        })}
      </View>
    );
  }

  if (post.taggedFriends?.length) {
    blocks.push(
      <View
        key="tags"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: space[2],
          paddingHorizontal: space[4]
        }}
      >
        <Users size={12} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
        <Text variant="meta">with</Text>
        {post.taggedFriends.map((friend) => (
          <Pressable
            key={friend.handle}
            haptic="none"
            onPress={() => !locked && openUser(friend.handle)}
            accessibilityLabel={`Open @${friend.handle}'s profile`}
          >
            <Text variant="meta-strong" className="text-white">
              @{friend.handle.replace(/^@/, "")}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  if (post.caption) {
    blocks.push(
      <View key="caption" style={{ paddingHorizontal: space[4] }}>
        <Text variant="body-sm">
          <Text variant="body-sm-strong">{post.user.handle}</Text>
          {"  "}
          {splitMentions(post.caption).map((seg, i) =>
            seg.handle ? (
              <Text
                key={`${seg.text}-${i}`}
                variant="body-sm-strong"
                suppressHighlighting
                onPress={() => !locked && router.push(`/user/${seg.handle}`)}
                accessibilityRole="link"
              >
                {seg.text}
              </Text>
            ) : (
              <Text key={`${seg.text}-${i}`} variant="body-sm">
                {seg.text}
              </Text>
            )
          )}
        </Text>
      </View>
    );
  }

  if (blocks.length === 0) return null;
  return <View style={[{ gap: space[3], paddingTop: space[2] }, dim]}>{blocks}</View>;
}
