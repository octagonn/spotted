import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { useFriends } from "@/hooks/queries/useFriends";
import { useMutualFriends, useUserFriends } from "@/hooks/queries/useFollowing";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import type { Profile } from "@/types/domain";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return people;
    }
    return people.filter(
      (p) =>
        (p.display_name ?? "").toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q)
    );
  }, [people, query]);

  const title = TITLES[type];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title} sub={`${people.length} ${people.length === 1 ? "person" : "people"}`} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${title.toLowerCase()}`} />
      </View>
      <FlashList
        data={filtered}
        keyExtractor={(item: Profile) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }: { item: Profile }) => (
          <PersonRow
            person={item}
            onOpen={() => router.push(`/user/${item.username}`)}
            onMessage={() => router.push(`/chat/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
              {isLoading ? "Loading…" : query ? "No matches." : `No ${title.toLowerCase()} yet.`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function PersonRow({
  person,
  onOpen,
  onMessage
}: {
  person: Profile;
  onOpen: () => void;
  onMessage: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityLabel={person.display_name} haptic={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 9,
          paddingHorizontal: 16
        }}
      >
        <Avatar name={person.display_name} uri={person.avatar_url} size={46} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
            {person.display_name}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontFamily: "Geist_400Regular", fontSize: 12.5, color: colors.fog }}>
            @{person.username}
          </Text>
        </View>
        <Pressable onPress={onMessage} accessibilityLabel={`Message ${person.display_name}`}>
          <View
            style={{
              paddingVertical: 7,
              paddingHorizontal: 16,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.iron
            }}
          >
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.bone }}>Message</Text>
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
}
