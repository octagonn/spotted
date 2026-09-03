import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useFriends, useFriendshipStates, useRespondToRequest, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { useMutualFriends, useUserFriends } from "@/hooks/queries/useFollowing";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useAuthStore } from "@/stores/auth";
import { relationshipButton, useRelationships } from "@/stores/relationships";
import { colors } from "@/theme/colors";
import { icon, space } from "@/theme/tokens";
import type { Profile } from "@/types/domain";
import type { RelationshipState } from "@/types/redesign";

type ListType = "friends" | "mutuals";
const TYPES: ListType[] = ["friends", "mutuals"];
const TITLES: Record<ListType, string> = {
  friends: "Friends",
  mutuals: "Mutual friends"
};

/**
 * Full-screen people list — Friends / Mutual friends, for the current user or
 * (with a `user` param) anyone else. Follow was removed: one relationship model.
 */
export default function PeopleListScreen() {
  const { type: rawType, user } = useLocalSearchParams<{ type: string; user?: string }>();
  const type: ListType = TYPES.includes(rawType as ListType) ? (rawType as ListType) : "friends";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authedId = useAuthStore((state) => state.userId);
  const [query, setQuery] = useState("");

  const isOther = Boolean(user) && user !== authedId;
  // Friends of another user go through the SECURITY DEFINER RPC.
  const ownFriends = useFriends();
  const otherFriends = useUserFriends(isOther ? user : null);
  const mutuals = useMutualFriends(user);

  const source = type === "mutuals" ? mutuals : isOther ? otherFriends : ownFriends;
  const isLoading = source.isLoading;
  const people = useMemo(() => source.data ?? [], [source.data]);

  // Am I friends with each person in this list? Drives Message vs Add.
  const states = useFriendshipStates(people.map((p) => p.id));
  const relationships = useRelationships();
  const sendFriendRequest = useSendFriendRequest();
  const respondToRequest = useRespondToRequest();
  // Tracked PER PERSON, not as one global lock. This used to be a single
  // `pendingAdd` string guarded with `|| pendingAdd`, so while ANY add was in
  // flight, tapping Add on anyone else silently did nothing — and if a mutation
  // never settled (a hung request), every Add on the screen stayed dead until
  // you navigated away and back. That was the reported "sometimes it just won't
  // let you add friends back, can't find a reason" glitch.
  const [pendingAdds, setPendingAdds] = useState<ReadonlySet<string>>(() => new Set());
  useRefreshOnFocus(["friendship-states", "friends", "user-friends", "mutual-friends"]);

  const addFriend = useCallback(
    (person: Profile) => {
      const current = relationships.stateFor(person.id, states.data?.get(person.id) ?? "none");
      if (person.id === authedId || current === "friend" || pendingAdds.has(person.id)) return;
      setPendingAdds((prev) => new Set(prev).add(person.id));
      const done = () =>
        setPendingAdds((prev) => {
          const next = new Set(prev);
          next.delete(person.id);
          return next;
        });
      if (current === "incoming") {
        // They already asked — accept instead of sending a second request.
        respondToRequest.mutate(
          { requesterId: person.id, accept: true },
          {
            onSuccess: () => {
              relationships.setRelationship(person.id, "friend");
              void states.refetch();
              done();
            },
            onError: done
          }
        );
        return;
      }
      sendFriendRequest.mutate(person.id, {
        onSuccess: () => {
          relationships.setRelationship(person.id, "requested");
          void states.refetch();
          done();
        },
        onError: done
      });
    },
    [relationships, states, pendingAdds, respondToRequest, sendFriendRequest, authedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return people;
    }
    return people.filter(
      (p) => (p.display_name ?? "").toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q)
    );
  }, [people, query]);

  const title = TITLES[type];
  const statesData = states.data;

  const renderItem: ListRenderItem<Profile> = useCallback(
    ({ item }) => (
      <PersonRow
        person={item}
        state={relationships.stateFor(item.id, statesData?.get(item.id) ?? "none")}
        isSelf={item.id === authedId}
        busy={pendingAdds.has(item.id)}
        onOpen={() => router.push(`/user/${item.username}`)}
        onMessage={() => router.push(`/chat/${item.id}`)}
        onAdd={() => addFriend(item)}
      />
    ),
    [relationships, statesData, authedId, pendingAdds, router, addFriend]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title} sub={`${people.length} ${people.length === 1 ? "person" : "people"}`} />
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] + 2 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${title.toLowerCase()}`} />
      </View>
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
        renderItem={renderItem}
        extraData={pendingAdds}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonRows count={6} />
          ) : (
            <EmptyState
              icon={<Users size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
              title={query ? "No matches" : `No ${title.toLowerCase()} yet`}
              body={query ? "Try a different name or username." : undefined}
            />
          )
        }
      />
    </View>
  );
}

function PersonRow({
  person,
  state,
  isSelf,
  onOpen,
  onMessage,
  onAdd,
  busy
}: {
  person: Profile;
  /** Friend / requested / incoming / none — drives the trailing action. */
  state: RelationshipState;
  /** You appear in your own friends' friend lists — there is nothing to do. */
  isSelf: boolean;
  onOpen: () => void;
  onMessage: () => void;
  onAdd: () => void;
  busy: boolean;
}) {
  // Friends get Message; everyone else gets the add-flow button, so a list of
  // someone else's friends is actionable instead of message-only.
  const button = relationshipButton(state);
  return (
    <UserRow
      name={person.display_name}
      avatarUrl={person.avatar_url}
      sub={`@${person.username}`}
      onPress={onOpen}
      right={
        isSelf ? (
          /* Your own row: no Add (it would send a request to yourself and the
             server rightly rejects it), and no Message-yourself either. */
          <Text variant="meta-strong">You</Text>
        ) : state === "friend" ? (
          <RelButton label="Message" kind="ghost" onPress={onMessage} />
        ) : (
          <RelButton label={button.label} kind={button.kind} disabled={button.disabled || busy} onPress={onAdd} />
        )
      }
    />
  );
}
