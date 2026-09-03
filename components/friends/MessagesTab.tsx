import { useRouter } from "expo-router";
import { Mail, MessageCircle } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SwipeableThreadRow } from "@/components/friends/SwipeableThreadRow";
import { useInboxThreadActions, useInboxThreads } from "@/components/friends/useInboxThreads";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/ui/SearchBar";
import { SettingNavRow } from "@/components/ui/SettingRow";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { UserRow } from "@/components/ui/UserRow";
import { useFriends } from "@/hooks/queries/useFriends";
import { useLeaveGroup } from "@/hooks/queries/useMessages";
import { useDeleteConversation, useMessageRequests } from "@/hooks/queries/useMessagesExtras";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

/**
 * Messages tab: search · message requests · active threads (swipe to delete).
 * Rendered inside the Friends screen's pull-to-refresh ScrollView, so rows are
 * mapped (a nested FlashList wouldn't virtualize) — see the Phase 17 follow-up.
 */
export function MessagesTab() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const inbox = useInboxThreads();
  const inboxActions = useInboxThreadActions();
  const friends = useFriends();
  const messageRequests = useMessageRequests();
  const deleteConversation = useDeleteConversation();
  const leaveGroup = useLeaveGroup();

  // Search by display name OR username.
  const matches = useMemo(
    () => (q ? (friends.data ?? []).filter((f) => `${f.display_name} ${f.username}`.toLowerCase().includes(q)) : []),
    [friends.data, q]
  );

  // DM list: real conversations only (groups always list, even before the
  // first message). No placeholder rows for friends without a thread.
  const threads = useMemo(() => (inbox.data ?? []).filter((t) => t.isGroup || !t.empty), [inbox.data]);

  const openThread = (profileId: string) => {
    inboxActions.clearUnread(profileId);
    router.push(`/chat/${profileId}`);
  };
  const openGroupThread = (conversationId: string) => {
    inboxActions.clearUnread(conversationId);
    router.push(`/chat/${conversationId}?group=1`);
  };

  const pending = messageRequests.data?.length ?? 0;

  return (
    <View>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search messages"
        containerStyle={{ marginHorizontal: space[4], marginBottom: space[2] }}
      />

      {q ? (
        matches.length ? (
          matches.map((friend) => (
            <UserRow
              key={`msg-friend-${friend.id}`}
              big
              name={friend.display_name}
              avatarUrl={friend.avatar_url}
              sub={`@${friend.username}`}
              onPress={() => router.push(`/chat/${friend.id}`)}
            />
          ))
        ) : (
          <EmptyState title="No friends match" body="Add them in Add Friends first." center paddingTop={space[8]} />
        )
      ) : (
        <>
          {pending > 0 ? (
            <View style={{ paddingHorizontal: space[4] }}>
              <SettingNavRow
                icon={<Mail size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
                title="Message requests"
                sub={`${pending} pending`}
                onPress={() => router.push("/message-requests")}
              />
            </View>
          ) : null}
          {inbox.isLoading && threads.length === 0 ? <SkeletonRows count={5} /> : null}
          {threads.map((thread, index) => (
            <View key={`thread-${thread.conversationId}`}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SwipeableThreadRow
                name={thread.name}
                // Swiping a group away = LEAVE it (deleting would nuke it for
                // every member; only 1:1 threads hard-delete).
                onDelete={() =>
                  thread.isGroup
                    ? leaveGroup.mutate(thread.conversationId)
                    : deleteConversation.mutate(thread.conversationId)
                }
              >
                <UserRow
                  big
                  name={thread.muted ? `${thread.name} · muted` : thread.name}
                  avatarUrl={thread.avatarUrl}
                  sub={thread.preview}
                  subStrong={thread.unread}
                  time={thread.time}
                  unread={thread.unread}
                  onPress={() =>
                    thread.isGroup ? openGroupThread(thread.conversationId) : openThread(thread.profileId)
                  }
                />
              </SwipeableThreadRow>
            </View>
          ))}
          {!inbox.isLoading && threads.length === 0 ? (
            <EmptyState
              icon={<MessageCircle size={icon.size.md} color={tokens.text.tertiary} strokeWidth={icon.stroke.thin} />}
              title="No messages yet"
              body="Open a friend's profile and tap Message."
              center
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Soft inset hairline between conversation rows (starts past the avatar). */
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.graphite,
    marginLeft: space[4] + 56 + space[3],
    marginRight: space[4]
  }
});
