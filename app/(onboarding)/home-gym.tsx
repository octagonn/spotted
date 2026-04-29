import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { mockGyms } from "@/lib/mockData";

export default function HomeGymScreen() {
  return (
    <Screen>
      <Text variant="display-md">PICK YOUR GYM.</Text>
      <Text variant="italic" className="mt-5">
        A gym is a place, not a group.
      </Text>
      <View className="mt-10 gap-3">
        {mockGyms.map((gym) => (
          <View key={gym.id} className="border border-iron bg-ink p-4">
            <Text variant="body-strong">{gym.name}</Text>
            <Text variant="caption" className="mt-1">
              {gym.address}
            </Text>
          </View>
        ))}
      </View>
      <Button className="mt-8" onPress={() => router.push("/schedule")}>
        Set home gym
      </Button>
    </Screen>
  );
}
