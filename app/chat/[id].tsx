import { useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { mockProfiles } from "@/lib/mockData";
import { colors } from "@/theme/colors";

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const friend = mockProfiles.find((profile) => profile.id === params.id) ?? mockProfiles[1];

  return (
    <Screen>
      <View className="flex-row items-center gap-3 border-b border-iron pb-4">
        <Avatar uri={friend.avatar_url} rounded="circle" />
        <View>
          <Text variant="body-strong">{friend.display_name}</Text>
          <Text variant="micro">@{friend.username}</Text>
        </View>
      </View>
      <View className="mt-8 min-h-[420px] justify-end gap-3">
        <View className="self-start border border-iron bg-ink p-4">
          <Text variant="body">Pull day?</Text>
        </View>
        <View className="self-end border border-white bg-white p-4">
          <Text variant="body" className="text-black">
            Already there.
          </Text>
        </View>
      </View>
      <Button className="mt-8" icon={<Send color={colors.black} size={17} />}>
        Send
      </Button>
    </Screen>
  );
}
