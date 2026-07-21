import { useRouter } from "expo-router";
import { Ban } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import {
  useMessageRequests,
  useRespondMessageRequest,
  useSetBlocked
} from "@/hooks/queries/useMessagesExtras";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Message Requests (#15): DMs from non-friends, pending until approved. The
 * request is text-only (media is blocked server-side until approval), and a
 * sender can have only one pending request. Approve → moves to the main inbox;
 * Decline → deletes the thread; Block → hides + blocks.
 */
export default function MessageRequestsScreen() {
  const router = useRouter();
  const requests = useMessageRequests();
  const respond = useRespondMessageRequest();
  const block = useSetBlocked();
  const rows = requests.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Message requests" />
      <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 28 }}>
        {requests.isLoading ? (
          <View style={{ paddingVertical: 28, alignItems: "center" }}>
            <ActivityIndicator color={colors.mist} />
          </View>
        ) : rows.length === 0 ? (
          <Text style={{ paddingTop: 44, textAlign: "center", fontSize: 13, color: colors.fog }}>
            No message requests.
          </Text>
        ) : (
          rows.map((request) => (
            <View key={request.conversationId} style={{ paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
              <Pressable
                onPress={() => router.push(`/chat/${request.requesterId}`)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Avatar name={request.requester?.display_name ?? "?"} uri={request.requester?.avatar_url} size={46} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
                    {request.requester?.display_name ?? "Someone"}
                  </Text>
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: colors.silver }}>
                    {request.lastMessage ?? `@${request.requester?.username ?? "unknown"}`}
                  </Text>
                </View>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() =>
                    respond.mutate(
                      { conversationId: request.conversationId, accept: true },
                      { onSuccess: () => showToast("Request accepted") }
                    )
                  }
                >
                  <View style={{ paddingVertical: 10, borderRadius: 12, backgroundColor: colors.white, alignItems: "center" }}>
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13.5, color: colors.black }}>Accept</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() =>
                    respond.mutate(
                      { conversationId: request.conversationId, accept: false },
                      { onSuccess: () => showToast("Request declined") }
                    )
                  }
                >
                  <View style={{ paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.iron, alignItems: "center" }}>
                    <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.silver }}>Decline</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel="Block"
                  onPress={() =>
                    block.mutate(
                      { otherUserId: request.requesterId, blocked: true },
                      { onSuccess: () => showToast("Blocked") }
                    )
                  }
                >
                  <View style={{ width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                    <Ban size={17} color="#EF4444" strokeWidth={2} />
                  </View>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
