import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { useCancelFriendRequest, useOutgoingRequests } from "@/hooks/queries/useFriends";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { colors } from "@/theme/colors";

/**
 * Requests you've SENT that haven't been answered yet, with a way to withdraw
 * each one — the Snapchat "pending" list.
 *
 * This lived as an always-expanded block inside Add Friends, which pushed
 * suggestions off-screen once you'd added a few people. It's its own screen now,
 * reached from a count button at the top of Add Friends.
 */
export default function PendingRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sent = useOutgoingRequests();
  const cancelRequest = useCancelFriendRequest();
  const [query, setQuery] = useState("");
  // Per-person, so cancelling one row never disables the others (the bug the
  // people list had with a single shared lock).
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(() => new Set());

  useRefreshOnFocus(["friend-requests-sent", "friendship-states"]);

  const rows = useMemo(() => {
    const all = sent.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (request) =>
        (request.profile.display_name ?? "").toLowerCase().includes(q) ||
        (request.profile.username ?? "").toLowerCase().includes(q)
    );
  }, [sent.data, query]);

  const cancel = (targetId: string) => {
    if (cancelling.has(targetId)) return;
    setCancelling((prev) => new Set(prev).add(targetId));
    const done = () =>
      setCancelling((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    cancelRequest.mutate(targetId, { onSuccess: done, onError: done });
  };

  const total = (sent.data ?? []).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Pending"
        sub={total ? `${total} sent ${total === 1 ? "request" : "requests"}` : "No requests waiting"}
      />

      {total > 6 ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search pending" />
        </View>
      ) : null}

      {/* ScrollView, not View — with 7+ requests the rows ran past the fold
          and the screen simply cut off ("can't scroll through pending"). */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {sent.isLoading ? (
          <Text style={{ paddingTop: 48, textAlign: "center", fontSize: 13, color: colors.fog }}>Loading…</Text>
        ) : rows.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
              {query
                ? "No matches."
                : "No pending requests. Anyone you add shows up here until they answer."}
            </Text>
          </View>
        ) : (
          rows.map((request) => {
            const busy = cancelling.has(request.targetId);
            return (
              <Pressable
                key={request.targetId}
                onPress={() => router.push(`/user/${request.profile.username}`)}
                accessibilityLabel={request.profile.display_name}
                haptic={false}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 9,
                    paddingHorizontal: 16
                  }}
                >
                  <Avatar name={request.profile.display_name} uri={request.profile.avatar_url} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}
                    >
                      {request.profile.display_name}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>
                      {`@${request.profile.username} · Requested`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => cancel(request.targetId)}
                    accessibilityLabel={`Cancel request to ${request.profile.display_name}`}
                    hitSlop={6}
                  >
                    <View
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.iron,
                        opacity: busy ? 0.5 : 1
                      }}
                    >
                      <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>
                        {busy ? "…" : "Cancel"}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
