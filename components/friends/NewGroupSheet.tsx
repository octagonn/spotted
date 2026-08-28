import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SheetTextInput } from "@/components/ui/SheetTextInput";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { useFriends } from "@/hooks/queries/useFriends";
import { useCreateGroupConversation } from "@/hooks/queries/useMessages";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Compose sheet (pencil icon, Messages tab): pick ONE friend → opens the 1:1
 * chat; pick SEVERAL → creates a group chat (name optional — defaults to the
 * members' first names). Members must be friends (server-enforced); cap 15.
 */
export function NewMessageSheet() {
  const sheet = useSheet();
  const router = useRouter();
  const friends = useFriends();
  const createGroup = useCreateGroupConversation();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { height: windowHeight } = useWindowDimensions();
  // Shrink the list while the group-name field is being typed in — otherwise
  // the sheet is taller than the space above the keyboard and the input (and
  // its text) ends up covered.
  const keyboardVisible = useKeyboardVisible();
  const listHeight = keyboardVisible ? 150 : Math.min(300, Math.round(windowHeight * 0.32));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 15 ? prev : [...prev, id]));

  // Search filters the list; picks made before searching stay selected.
  const query = search.trim().toLowerCase();
  const visibleFriends = (friends.data ?? []).filter(
    (f) =>
      !query ||
      (f.display_name ?? "").toLowerCase().includes(query) ||
      (f.username ?? "").toLowerCase().includes(query)
  );

  const isGroup = selected.length >= 2;

  const go = () => {
    if (selected.length === 0) return;
    if (!isGroup) {
      sheet.close();
      router.push(`/chat/${selected[0]}`);
      return;
    }
    if (createGroup.isPending) return;
    // Blank name stays blank — the server stores NULL and every member sees
    // the OTHER members' names (per-viewer), not the creator's perspective.
    const title = name.trim().slice(0, 40);
    createGroup.mutate(
      { title, memberIds: selected },
      {
        onSuccess: (conversationId) => {
          sheet.close();
          showToast("Group created");
          router.push(`/chat/${conversationId}?group=1`);
        },
        onError: () => showToast("Couldn't create the group — try again")
      }
    );
  };

  return (
    <View>
      <SheetTitle>New message</SheetTitle>
      <Text style={{ paddingHorizontal: 20, paddingBottom: 10, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>
        Pick a friend to chat — pick several to start a group.
      </Text>
      {/* Name field ABOVE the list (and a sheet-aware input) so the keyboard
          can never cover what's being typed. */}
      {isGroup ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <SheetTextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholder="Group name (optional)"
            placeholderTextColor={colors.ash}
            style={{
              backgroundColor: colors.charcoal,
              borderWidth: 1,
              borderColor: colors.iron,
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 14,
              fontSize: 15,
              color: colors.bone,
              fontFamily: "Geist_400Regular"
            }}
          />
        </View>
      ) : null}
      {/* Search — sheet-aware input so the keyboard never covers it. */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <SheetTextInput
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search friends"
          placeholder="Search friends"
          placeholderTextColor={colors.ash}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            backgroundColor: colors.charcoal,
            borderWidth: 1,
            borderColor: colors.iron,
            borderRadius: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            fontSize: 15,
            color: colors.bone,
            fontFamily: "Geist_400Regular"
          }}
        />
      </View>
      {/* Fixed height so the sheet stays stable while picking. */}
      <View style={{ height: listHeight }}>
        {(friends.data ?? []).length === 0 ? (
          <Text style={{ paddingTop: 24, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            Add friends first — messages are friends-only.
          </Text>
        ) : visibleFriends.length === 0 ? (
          <Text style={{ paddingTop: 24, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            No friends match &quot;{search.trim()}&quot;.
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {visibleFriends.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                selected={selected.includes(friend.id)}
                onPress={() => toggle(friend.id)}
              />
            ))}
          </SheetScrollView>
        )}
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Button onPress={go} disabled={selected.length === 0 || createGroup.isPending}>
          {createGroup.isPending
            ? "Creating…"
            : isGroup
              ? `Create group chat (${selected.length + 1})`
              : selected.length === 1
                ? "Message"
                : "Pick friends"}
        </Button>
      </View>
    </View>
  );
}
