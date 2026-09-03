import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { UserRow } from "@/components/ui/UserRow";
import { useCancelFriendRequest, useOutgoingRequests } from "@/hooks/queries/useFriends";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { colors } from "@/theme/colors";
import { icon, space } from "@/theme/tokens";

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
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] + 2 }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search pending" />
        </View>
      ) : null}

      {/* ScrollView, not View — with 7+ requests the rows ran past the fold
          and the screen simply cut off ("can't scroll through pending"). */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}>
        {sent.isLoading ? (
          <SkeletonRows count={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
            title={query ? "No matches" : "No pending requests"}
            body={query ? "Try a different name." : "Anyone you add shows up here until they answer."}
          />
        ) : (
          rows.map((request) => {
            const busy = cancelling.has(request.targetId);
            return (
              <UserRow
                key={request.targetId}
                name={request.profile.display_name}
                avatarUrl={request.profile.avatar_url}
                sub={`@${request.profile.username} · Requested`}
                onPress={() => router.push(`/user/${request.profile.username}`)}
                right={
                  <RelButton
                    label={busy ? "…" : "Cancel"}
                    kind="ghost"
                    disabled={busy}
                    onPress={() => cancel(request.targetId)}
                  />
                }
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
