import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useGymPresence } from "@/hooks/queries/useGymPresence";

export default function GymDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const presence = useGymPresence();
  const gym = presence.data?.gyms.find((item) => item.id === params.id) ?? presence.data?.gyms[0];
  const friends = presence.data?.presence.filter((item) => item.gym.id === gym?.id) ?? [];

  return (
    <Screen>
      <Text variant="display-sm">{gym?.name.toUpperCase() ?? "GYM"}</Text>
      <Text variant="caption" className="mt-2 italic">
        Friends here now. Recent posts you can already see.
      </Text>
      <View className="mt-8 gap-3">
        {presence.isLoading ? <SkeletonRows count={3} /> : null}
        {friends.map((friend) => (
          <View key={friend.id} className="flex-row items-center gap-3 border border-hairline-strong bg-ink p-3">
            <Avatar uri={friend.profile.avatar_url} />
            <View>
              <Text variant="body-strong">{friend.profile.display_name}</Text>
              <Text variant="micro">@{friend.profile.username}</Text>
            </View>
          </View>
        ))}
      </View>
      <Button className="mt-8">Your gym</Button>
    </Screen>
  );
}
