import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useFriends } from "@/hooks/queries/useFriends";
import { space } from "@/theme/tokens";

/** Tag friends on the post — multi-select with search. */
export function FriendsSheet({ initial, onDone }: { initial: string[]; onDone: (ids: string[]) => void }) {
  const sheet = useSheet();
  const friends = useFriends();
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(300, Math.round(windowHeight * 0.32));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial);
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (friend) => !q || `${friend.display_name} ${friend.username}`.toLowerCase().includes(q)
  );

  return (
    <View>
      <SheetTitle>Tag friends</SheetTitle>
      <View style={{ paddingHorizontal: space[4] + 4, paddingBottom: space[2] }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      {/* Fixed height so the sheet doesn't shrink under the keyboard while
          searching, capped to the screen so the Done button never clips. */}
      <View style={{ height: listHeight }}>
        {friends.isLoading ? (
          <SkeletonRows count={4} style={{ paddingTop: space[1] + 2 }} />
        ) : rows.length === 0 ? (
          <Text variant="meta" className="pt-7 text-center">
            {q ? "No friends match that name." : "No friends yet — add your crew from the Friends tab."}
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                selected={selected.includes(friend.id)}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                onPress={() => toggle(friend.id)}
              />
            ))}
          </SheetScrollView>
        )}
      </View>
      <View style={{ paddingHorizontal: space[4] + 4, paddingTop: space[3] }}>
        <Button
          onPress={() => {
            onDone(selected);
            sheet.close();
          }}
        >
          Done
        </Button>
      </View>
    </View>
  );
}
