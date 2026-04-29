import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { mockGyms, mockPermanentDrops, mockProfiles, mockRoutine } from "@/lib/mockData";

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
        @{profile.username} / {mockGyms[0].name} / usually 5:00 PM
      </Text>
      <View className="mt-8 border border-iron bg-ink p-4">
        <Text variant="body">{profile.bio ?? "No bio. Probably lifting."}</Text>
      </View>
      <View className="mt-8 border border-iron bg-ink p-4">
        <Text variant="micro" className="text-mist">
          ROUTINE
        </Text>
        <Text variant="title" className="mt-1">
          ARNOLD SPLIT
        </Text>
        <View className="mt-5 gap-2">
          {mockRoutine.slice(0, 4).map((item) => (
            <View key={item.day} className="flex-row items-center border-t border-iron pt-3">
              <Text variant="micro" className="w-14 text-white">
                {item.day}
              </Text>
              <Text variant="body" className="flex-1">
                {item.muscle}
              </Text>
              <Text variant="micro">{item.time}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="mt-8">
        <Text variant="title">SAVED DROPS</Text>
        <View className="mt-4 flex-row gap-3">
          {mockPermanentDrops.map((drop) => (
            <View key={drop.id} className="flex-1 border border-iron bg-ink">
              <View className="aspect-[4/5] bg-graphite">
                <Image source={{ uri: drop.media_url }} contentFit="cover" className="h-full w-full" />
              </View>
              <View className="border-t border-iron p-3">
                <Text variant="micro" className="text-white">
                  {drop.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <Button className="mt-8">Add friend</Button>
    </Screen>
  );
}
