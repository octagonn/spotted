import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetSub, SheetTitle } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useFriends } from "@/hooks/queries/useFriends";
import { showToast } from "@/stores/ui";
import { space } from "@/theme/tokens";

/**
 * Shared "pick a friend and fire something at them" sheet body — search over
 * your friends, tap a row to send, checkmark on success with rollback on
 * error. ForwardSheet and ShareToFriendSheet are thin wrappers over this;
 * only the strings and the mutation differ.
 */
export function PickFriendSheet({
  title,
  sub,
  emptyText,
  successToast,
  errorToast,
  send
}: {
  title: string;
  sub: string;
  /** Shown when the user has no friends yet (search misses have their own copy). */
  emptyText: string;
  successToast: (firstName: string) => string;
  errorToast: string;
  /** Fire the mutation; MUST call onSuccess/onError so the row state settles. */
  send: (friendId: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
}) {
  const friends = useFriends();
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter((f) => !q || `${f.display_name} ${f.username}`.toLowerCase().includes(q));

  const pick = (id: string, name: string) => {
    setSent((prev) => new Set(prev).add(id));
    send(id, {
      onSuccess: () => showToast(successToast(name.split(" ")[0])),
      onError: () => {
        setSent((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        showToast(errorToast);
      }
    });
  };

  return (
    <View>
      <SheetTitle>{title}</SheetTitle>
      <SheetSub>{sub}</SheetSub>
      <View style={{ paddingHorizontal: space[4] + 4, paddingBottom: space[2] }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      <View style={{ height: 320 }}>
        {friends.isLoading ? (
          <SkeletonRows count={3} />
        ) : rows.length === 0 ? (
          <Text variant="meta" className="pt-7 text-center">
            {q ? "No friends match that name." : emptyText}
          </Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                selected={sent.has(friend.id)}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                onPress={() => !sent.has(friend.id) && pick(friend.id, friend.display_name)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
