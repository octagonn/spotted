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
import { useNotSpotted } from "@/hooks/queries/useNotSpotted";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
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

/** "Rest day" — they declared one; a taunt would bounce off the server anyway. */
function RestDay() {
  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: space[1] + 2,
        borderRadius: radius.pill,
        backgroundColor: tokens.bg.raised
      }}
    >
      <Text variant="label" className="text-fog">
        Rest day
      </Text>
    </View>
  );
}

/** Friends tab: search · every friend with Taunt / Went today / Rest day. */
export function FriendsListTab() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const friends = useFriends();
  const sendTaunt = useSendTaunt();
  // One server call answers went / rest / already-taunted for every friend in
  // THEIR local day (the old per-tab posts query used the viewer's midnight).
  // useSendTaunt flips `taunted_by_me_today` optimistically and rolls back.
  const notSpotted = useNotSpotted();
  const status = useMemo(() => new Map((notSpotted.data ?? []).map((f) => [f.user_id, f])), [notSpotted.data]);

  const tauntFriend = (friendId: string) => {
    if (status.get(friendId)?.taunted_by_me_today || sendTaunt.isPending) return;
    const line = randomTauntLine();
    sendTaunt.mutate(
      { targetId: friendId, lineId: line.id, lineText: line.text, source: "friends_list" },
      // Errors toast (and roll back) inside useSendTaunt.
      { onSuccess: () => showToast("Taunt sent") }
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
          const state = status.get(friend.id);
          const went = state?.went_today ?? false;
          const rest = !went && (state?.rest_today ?? false);
          const taunted = state?.taunted_by_me_today ?? false;
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
                  ) : rest ? (
                    <RestDay />
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
