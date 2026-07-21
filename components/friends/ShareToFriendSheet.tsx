import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetSub, SheetTitle } from "@/components/ui/Sheet";
import { useFriends } from "@/hooks/queries/useFriends";
import { useShareToMessage, type ShareKind } from "@/hooks/queries/useMessagesExtras";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Share an in-app item (post / check-in / stream / workout) into a DM (#8).
 * Only mutual friends are listed. Reusable from any screen that can produce a
 * (sharedKind, sharedId, label).
 */
export function ShareToFriendSheet({
  sharedKind,
  sharedId,
  label
}: {
  sharedKind: ShareKind;
  sharedId: string;
  label: string;
}) {
  const friends = useFriends();
  const share = useShareToMessage();
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (f) => !q || `${f.display_name} ${f.username}`.toLowerCase().includes(q)
  );

  const send = (id: string, name: string) => {
    setSent((prev) => new Set(prev).add(id));
    share.mutate(
      { targetUserId: id, sharedKind, sharedId, label },
      {
        onSuccess: () => showToast(`Sent to ${name.split(" ")[0]}`),
        onError: () => {
          setSent((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          showToast("Couldn't send — try again");
        }
      }
    );
  };

  return (
    <View>
      <SheetTitle>Send to</SheetTitle>
      <SheetSub>Share this with a friend.</SheetSub>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      <View style={{ height: 320 }}>
        {rows.length === 0 ? (
          <Text style={{ paddingTop: 28, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            {q ? "No friends match that name." : "Add friends to share with them."}
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
                onPress={() => !sent.has(friend.id) && send(friend.id, friend.display_name)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
