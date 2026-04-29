import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

export default function OnboardingCreateProfileScreen() {
  return (
    <Screen>
      <View className="min-h-[660px] justify-end">
        <Text variant="display-md">MAKE A FACE.</Text>
        <Text variant="italic" className="mt-5">
          Username, display name, avatar. No committee meeting.
        </Text>
        <View className="mt-10 flex-row items-center gap-4 border border-iron bg-ink p-4">
          <Avatar size="lg" />
          <View>
            <Text variant="body-strong">octavio</Text>
            <Text variant="micro">@octavio</Text>
          </View>
        </View>
        <Button className="mt-8" onPress={() => router.push("/home-gym")}>
          Next
        </Button>
      </View>
    </Screen>
  );
}
