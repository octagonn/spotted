import { router } from "expo-router";
import { Eye, MessageCircle, Plus, Repeat2, Search } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useFriendSuggestions, useFriends, useSendFriendRequest } from "@/hooks/queries/useFriends";
import { mockProfileSignals, mockStoryReplies } from "@/lib/mockData";
import { colors } from "@/theme/colors";

export default function FriendsScreen() {
  const friends = useFriends();
  const suggestions = useFriendSuggestions();
  const sendFriendRequest = useSendFriendRequest();
  const friendList = friends.data ?? [];
  const suggestionList = suggestions.data ?? [];

  return (
    <Screen>
      <Text variant="display-sm">INBOX</Text>
      <Text variant="caption" className="mt-2 italic">
        People are watching. Some of them answered.
      </Text>

      <View className="mt-8 flex-row gap-3">
        <View className="flex-1 border border-iron bg-ink p-3">
          <Eye color={colors.mist} size={17} />
          <Text variant="display-sm" className="mt-3">
            {mockProfileSignals[0].value}
          </Text>
          <Text variant="micro">PROFILE VIEWS</Text>
        </View>
        <View className="flex-1 border border-iron bg-ink p-3">
          <Repeat2 color={colors.mist} size={17} />
          <Text variant="display-sm" className="mt-3">
            {mockProfileSignals[1].value}
          </Text>
          <Text variant="micro">REPLAYS</Text>
        </View>
      </View>

      <View className="mt-8 flex-row items-center gap-3 border border-iron bg-ink px-4 py-3">
        <Search color={colors.fog} size={18} />
        <Text variant="caption" className="flex-1">
          Search username
        </Text>
        <Plus color={colors.white} size={18} />
      </View>

      <View className="mt-8">
        <Text variant="micro" className="text-white">
          STORY REPLIES
        </Text>
        {mockStoryReplies.length === 0 ? (
          <View className="mt-4">
            <EmptyState title="NO REPLIES." body="Post a drop worth answering." />
          </View>
        ) : (
          <View className="mt-3 gap-3">
            {mockStoryReplies.map((reply) => (
              <Pressable
                key={reply.id}
                className="flex-row items-center gap-3 border border-iron bg-ink p-3"
                onPress={() => router.push(`/chat/${reply.from.id}`)}
              >
                <Avatar uri={reply.from.avatar_url} />
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text variant="body-strong">{reply.from.display_name}</Text>
                    {reply.unread ? <View className="h-2 w-2 bg-white" /> : null}
                  </View>
                  <Text variant="caption" className="mt-1">
                    {reply.preview}
                  </Text>
                </View>
                <MessageCircle color={colors.fog} size={17} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {suggestionList.length > 0 ? (
        <View className="mt-8">
          <Text variant="micro" className="text-white">
            AT YOUR GYM
          </Text>
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
                <Text variant="body-strong">{index === 0 ? 18 : 9}D</Text>
                <Text variant="micro">STORY STREAK</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
