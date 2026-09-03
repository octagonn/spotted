import { useRouter, type Href } from "expo-router";
import { View } from "react-native";

import { TenureChip } from "@/components/communities/Badges";
import { MessageBubble, TimeSeparator } from "@/components/friends/ChatBubbles";
import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { SkeletonChatBubbles } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import type { CommunityMessage } from "@/hooks/queries/useCommunities";
import { tenureBadge } from "@/lib/communityTenure";
import { space } from "@/theme/tokens";

type CommunityChatListProps = {
  messages: CommunityMessage[];
  loading: boolean;
  userId: string | null;
  joinedAtById: Map<string, string>;
  communityCreatedAt: string | null | undefined;
};

/**
 * Community chat transcript. Sender identity (avatar · name · tenure) shows on
 * the first message of each run; system announcements are centered, no bubble.
 */
export function CommunityChatList({
  messages,
  loading,
  userId,
  joinedAtById,
  communityCreatedAt
}: CommunityChatListProps) {
  const router = useRouter();
  if (messages.length === 0) {
    return loading ? (
      <SkeletonChatBubbles />
    ) : (
      <Text variant="meta" className="pt-8 text-center">
        No messages yet. Say something.
      </Text>
    );
  }
  return (
    <>
      <TimeSeparator label="Chat" />
      {messages.map((message, index, list) => {
        if (message.kind === "system") {
          return (
            <View
              key={message.id}
              style={{ alignItems: "center", paddingVertical: space[2] + 2, paddingHorizontal: space[6] }}
            >
              <Text variant="meta-strong" className="text-center text-mist">
                {message.content}
              </Text>
            </View>
          );
        }
        const mine = message.sender_id === userId;
        const firstOfRun = index === 0 || list[index - 1].sender_id !== message.sender_id;
        const senderName = message.sender?.display_name ?? message.sender?.username ?? "Member";
        const badge = tenureBadge(joinedAtById.get(message.sender_id), communityCreatedAt);
        const openSender = () => {
          if (!message.sender?.username) return;
          router.push(`/user/${message.sender.username}` as Href);
        };
        return (
          <View key={message.id} style={{ marginTop: firstOfRun && index > 0 ? space[2] + 2 : 0 }}>
            {!mine && firstOfRun ? (
              <Pressable onPress={openSender} haptic="none" accessibilityLabel={`Open ${senderName}'s profile`}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[2],
                    paddingLeft: 2,
                    paddingBottom: space[1]
                  }}
                >
                  <Avatar name={senderName} uri={message.sender?.avatar_url ?? null} size={28} />
                  <Text variant="meta-strong" className="text-bone">
                    {senderName}
                  </Text>
                  {badge ? <TenureChip badge={badge} /> : null}
                </View>
              </Pressable>
            ) : null}
            <View style={{ paddingLeft: mine ? 0 : 36 }}>
              <MessageBubble mine={mine} text={message.content} />
            </View>
          </View>
        );
      })}
    </>
  );
}
