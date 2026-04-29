import { router } from "expo-router";
import { MessageCircle, Plus, Search } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useFriendSuggestions, useFriends, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { colors } from "@/theme/colors";

export default function FriendsScreen() {
  const friends = useFriends();
  const suggestions = useFriendSuggestions();
  const sendFriendRequest = useSendFriendRequest();
  const friendList = friends.data ?? [];
  const suggestionList = suggestions.data ?? [];

  return (
    <Screen>
      <Text variant="display-sm">FRIENDS</Text>
      <Text variant="caption" className="mt-2 italic">
        Add the people who make skipping embarrassing.
      </Text>
      <View className="mt-8 flex-row items-center gap-3 border border-iron bg-ink px-4 py-3">
        <Search color={colors.fog} size={18} />
        <Text variant="caption" className="flex-1">
          Search username
        </Text>
        <Plus color={colors.white} size={18} />
      </View>
      {suggestionList.length > 0 ? (
        <View className="mt-8">
          <Text variant="micro">AT YOUR GYM</Text>
          <View className="mt-3 gap-3">
            {suggestionList.slice(0, 8).map((suggestion) => (
              <View key={suggestion.id} className="flex-row items-center gap-3 border border-iron bg-ink p-3">
                <Avatar uri={suggestion.avatar_url} />
                <View className="flex-1">
                  <Text variant="body-strong">{suggestion.display_name}</Text>
                  <Text variant="micro">@{suggestion.username}</Text>
                  {suggestion.mutual_friends_count > 0 ? (
                    <Text variant="caption" className="mt-1">
                      {suggestion.mutual_friends_count} mutual friends
                    </Text>
                  ) : null}
                </View>
                <Button className="min-h-10 px-4" onPress={() => sendFriendRequest.mutate(suggestion.id)}>
                  Add
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View className="mt-8 flex-row border-b border-iron">
        {["FRIENDS", "REQUESTS", "CHATS"].map((label, index) => (
          <View key={label} className={`flex-1 border-r border-iron py-3 ${index === 2 ? "border-r-0" : ""}`}>
            <Text variant="micro" className="text-center text-white">
              {label}
            </Text>
          </View>
        ))}
      </View>
      {friendList.length === 0 ? (
        <View className="mt-6">
          <EmptyState title="NO CREW." body="No friends yet. Add someone before they catch you skipping pull day." />
        </View>
      ) : (
        <View className="mt-4 gap-3">
          {friendList.map((friend, index) => (
            <Pressable
              key={friend.id}
              className="flex-row items-center gap-3 border border-iron bg-ink p-3"
              onPress={() => router.push(`/chat/${friend.id}`)}
            >
              <Avatar uri={friend.avatar_url} />
              <View className="flex-1">
                <Text variant="body-strong">{friend.display_name}</Text>
                <Text variant="micro">@{friend.username}</Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center gap-1">
                  <Text variant="body-strong">{index === 0 ? 18 : 9}</Text>
                  <Text variant="micro">D</Text>
                </View>
                <MessageCircle color={colors.fog} size={17} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
