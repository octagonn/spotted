import { useQueryClient } from "@tanstack/react-query";
import { SquarePen } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Keyboard, Platform, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FindFriendsTab } from "@/components/friends/FindFriendsTab";
import { FriendsListTab } from "@/components/friends/FriendsListTab";
import { MessagesTab } from "@/components/friends/MessagesTab";
import { NewMessageSheet } from "@/components/friends/NewGroupSheet";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { colors } from "@/theme/colors";
import { tabBarClearance } from "@/theme/layout";
import { icon, space, tokens } from "@/theme/tokens";

const TABS = ["Messages", "Friends", "Add Friends"];
const REFRESH_KEYS = [
  "inbox-threads",
  "friends",
  "friend-requests",
  "friend-requests-sent",
  "friend-suggestions",
  "message-requests",
  "friendship-states"
];

/**
 * Friends tab: one segmented control — Messages / Friends / Add Friends —
 * each tab is its own component that owns its queries and state, so only the
 * visible tab's data is live.
 */
export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("Messages");

  // Tab screens never unmount, so nothing refetched on tab switch — new
  // messages and friend requests only appeared after backgrounding the app.
  useRefreshOnFocus(REFRESH_KEYS);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.allSettled(REFRESH_KEYS.map((key) => queryClient.refetchQueries({ queryKey: [key] }))).finally(() =>
      setRefreshing(false)
    );
  }, [queryClient]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingTop: insets.top + space[2], paddingBottom: tabBarClearance(insets.bottom) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.white}
            colors={[colors.white]}
          />
        }
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space[4],
            paddingBottom: space[1]
          }}
        >
          <Text variant="screen-title">Friends</Text>
          {/* Compose: one friend → 1:1 chat, several → group. */}
          {tab === "Messages" ? (
            <IconButton
              variant="plain"
              icon={<SquarePen size={icon.size.md} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
              accessibilityLabel="New message"
              onPress={() => sheet.open(<NewMessageSheet />)}
              style={{ marginRight: -space[2] }}
            />
          ) : null}
        </View>
        <Segmented
          options={TABS}
          value={tab}
          onChange={(next) => {
            Keyboard.dismiss();
            setTab(next);
          }}
          style={{ marginTop: space[2], marginBottom: space[3] }}
        />
        {tab === "Messages" ? <MessagesTab /> : tab === "Friends" ? <FriendsListTab /> : <FindFriendsTab />}
      </ScrollView>
    </View>
  );
}
