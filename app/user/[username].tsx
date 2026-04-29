import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { mockGyms, mockProfiles } from "@/lib/mockData";

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ username: string }>();
  const profile = mockProfiles.find((item) => item.username === params.username) ?? mockProfiles[1];

  return (
    <Screen>
      <Avatar uri={profile.avatar_url} size="lg" />
      <Text variant="display-sm" className="mt-8">
        {profile.display_name.toUpperCase()}
      </Text>
      <Text variant="micro" className="mt-2">
        @{profile.username} · {mockGyms[0].name}
      </Text>
      <View className="mt-8 border border-iron bg-ink p-4">
        <Text variant="body">{profile.bio ?? "No bio. Probably lifting."}</Text>
      </View>
      <Button className="mt-8">Add friend</Button>
    </Screen>
  );
}
