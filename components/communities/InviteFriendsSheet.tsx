import { useState } from "react";
import { ScrollView, View } from "react-native";

import { RelButton } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetSub, SheetTitle } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useInviteToCommunity } from "@/hooks/queries/useCommunities";
import { useFriends } from "@/hooks/queries/useFriends";
import { showToast } from "@/stores/ui";
import { space } from "@/theme/tokens";

/** Invite friends to the community — searchable, invited state per row. */
export function InviteFriendsSheet({ communityId, communityName }: { communityId: string; communityName: string }) {
  const friends = useFriends();
  const invite = useInviteToCommunity(communityId);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter((f) => !q || `${f.display_name} ${f.username}`.toLowerCase().includes(q));

  const send = (friendId: string) => {
    invite.mutate(friendId, {
      onSuccess: () => setInvited((prev) => new Set(prev).add(friendId)),
      onError: () => showToast("Couldn't send the invite — try again")
    });
  };

  return (
    <View>
      <SheetTitle>Invite friends</SheetTitle>
      <SheetSub>{`They'll get a notification to join ${communityName}.`}</SheetSub>
      <View style={{ paddingHorizontal: space[4] + 4, paddingBottom: space[2] }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      {/* Fixed height (not maxHeight): the dynamic-sizing sheet re-measures
          whenever its content height moves, which bounced a dismissed sheet
          back up. A ScrollView inside makes long lists reachable. */}
      <View style={{ height: 320 }}>
        {friends.isLoading ? (
          <SkeletonRows count={3} />
        ) : rows.length === 0 ? (
          <Text variant="meta" className="pt-7 text-center">
            {q ? "No friends match that name." : "No friends yet — add your crew from the Friends tab first."}
          </Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((friend) => (
              <UserRow
                key={friend.id}
                name={friend.display_name}
                avatarUrl={friend.avatar_url}
                sub={`@${friend.username}`}
                right={
                  <RelButton
                    label={invited.has(friend.id) ? "Invited ✓" : "Invite"}
                    kind={invited.has(friend.id) ? "quiet" : "primary"}
                    disabled={invited.has(friend.id) || invite.isPending}
                    onPress={() => send(friend.id)}
                  />
                }
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
