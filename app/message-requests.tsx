import { useRouter } from "expo-router";
import { Ban, Mail } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { UserRow } from "@/components/ui/UserRow";
import { useMessageRequests, useRespondMessageRequest, useSetBlocked } from "@/hooks/queries/useMessagesExtras";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

/**
 * Message Requests: DMs from non-friends, pending until approved. The request
 * is text-only (media is blocked server-side until approval). Approve → moves
 * to the main inbox; Decline → deletes the thread; Block → hides + blocks.
 */
export default function MessageRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requests = useMessageRequests();
  const respond = useRespondMessageRequest();
  const block = useSetBlocked();
  const rows = requests.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Message requests" />
      <ScrollView contentContainerStyle={{ paddingTop: space[1], paddingBottom: insets.bottom + space[6] }}>
        {requests.isLoading ? (
          <SkeletonRows count={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Mail size={icon.size.md} color={tokens.text.tertiary} strokeWidth={icon.stroke.thin} />}
            title="No message requests"
            center
          />
        ) : (
          rows.map((request) => {
            const name = request.requester?.display_name ?? "Someone";
            return (
              <View
                key={request.conversationId}
                style={{ paddingBottom: space[3], borderBottomWidth: 1, borderBottomColor: tokens.border.subtle }}
              >
                <UserRow
                  big
                  name={name}
                  avatarUrl={request.requester?.avatar_url}
                  sub={request.lastMessage ?? `@${request.requester?.username ?? "unknown"}`}
                  onPress={() => router.push(`/chat/${request.requesterId}`)}
                />
                <View style={{ flexDirection: "row", gap: space[2], paddingHorizontal: space[4] }}>
                  <Button
                    style={{ flex: 1 }}
                    accessibilityLabel={`Accept message request from ${name}`}
                    onPress={() =>
                      respond.mutate(
                        { conversationId: request.conversationId, accept: true },
                        { onSuccess: () => showToast("Request accepted") }
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    style={{ flex: 1 }}
                    accessibilityLabel={`Decline message request from ${name}`}
                    onPress={() =>
                      respond.mutate(
                        { conversationId: request.conversationId, accept: false },
                        { onSuccess: () => showToast("Request declined") }
                      )
                    }
                  >
                    Decline
                  </Button>
                  <IconButton
                    icon={
                      <Ban size={icon.size.xs + 1} color={tokens.status.danger} strokeWidth={icon.stroke.regular} />
                    }
                    accessibilityLabel={`Block ${name}`}
                    haptic="warning"
                    onPress={() =>
                      block.mutate(
                        { otherUserId: request.requesterId, blocked: true },
                        { onSuccess: () => showToast("Blocked") }
                      )
                    }
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
