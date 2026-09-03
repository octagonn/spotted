import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/ui/SearchBar";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useFriends } from "@/hooks/queries/useFriends";
import { useMyTauntsToday, useSendTaunt } from "@/hooks/queries/useTaunts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { randomTauntLine } from "@/lib/tauntLines";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** "Went today" — a friend showed up; the one gold moment on this list. */
function WentToday() {
  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: space[1] + 2,
        borderRadius: radius.pill,
        backgroundColor: tokens.accent.goldSubtle
      }}
    >
      <Text variant="label" className="text-gold">
        Went today
      </Text>
    </View>
  );
}

/** Friends tab: search · every friend with Taunt / Went today. */
export function FriendsListTab() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const friends = useFriends();
  const sendTaunt = useSendTaunt();
  // Server truth for who I've already taunted today — survives tab switches
  // and app restarts (the local set only covers this render session).
  const myTauntsToday = useMyTauntsToday();
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());

  // Which friends already posted (went to the gym) today.
  const friendsPostedToday = useQuery({
    queryKey: ["friends-posted-today", (friends.data ?? []).map((f) => f.id).join(",")],
    enabled: isSupabaseConfigured && (friends.data ?? []).length > 0,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<Set<string>> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("posts")
        .select("user_id")
        .gte("created_at", startOfDay.toISOString())
        .in(
          "user_id",
          (friends.data ?? []).map((f) => f.id)
        );
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.user_id));
    }
  });

  const tauntFriend = (friendId: string) => {
    if (nudgedIds.has(friendId) || myTauntsToday.data?.targets.has(friendId) || sendTaunt.isPending) return;
    // Optimistic: flip to "Taunted" at tap time so rapid taps can't double-send.
    setNudgedIds((prev) => new Set(prev).add(friendId));
    const line = randomTauntLine();
    sendTaunt.mutate(
      { targetId: friendId, lineId: line.id, lineText: line.text },
      {
        onSuccess: () => showToast("Taunt sent"),
        // Roll back; the error toast itself comes from useSendTaunt.
        onError: () =>
          setNudgedIds((prev) => {
            const next = new Set(prev);
            next.delete(friendId);
            return next;
          })
      }
    );
  };

  const rows = useMemo(
    () =>
      q
        ? (friends.data ?? []).filter((f) => `${f.display_name} ${f.username}`.toLowerCase().includes(q))
        : (friends.data ?? []),
    [friends.data, q]
  );

  return (
    <View>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search friends"
        containerStyle={{ marginHorizontal: space[4], marginBottom: space[2] }}
      />
      {(friends.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Users size={icon.size.md} color={tokens.text.tertiary} strokeWidth={icon.stroke.thin} />}
          title="No friends yet"
          body="Add them in the Add Friends tab."
          center
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No friends match" center paddingTop={space[8]} />
      ) : (
        rows.map((friend, index) => {
          const went = friendsPostedToday.data?.has(friend.id) ?? false;
          const taunted = nudgedIds.has(friend.id) || (myTauntsToday.data?.targets.has(friend.id) ?? false);
          return (
            <View key={`friend-${friend.id}`}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <UserRow
                big
                name={friend.display_name}
                avatarUrl={friend.avatar_url}
                sub={`@${friend.username}`}
                right={
                  went ? (
                    <WentToday />
                  ) : (
                    <RelButton
                      label={taunted ? "Taunted" : "Taunt"}
                      kind={taunted ? "quiet" : "ghost"}
                      disabled={taunted}
                      onPress={() => tauntFriend(friend.id)}
                    />
                  )
                }
                onPress={() => router.push(`/user/${friend.username}`)}
              />
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.graphite,
    marginLeft: space[4] + 56 + space[3],
    marginRight: space[4]
  }
});
