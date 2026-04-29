import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

export default function WelcomeScreen() {
  return (
    <Screen>
      <View className="min-h-[660px] justify-end">
        <Text variant="display-lg">SPOTTED</Text>
        <Text variant="italic" className="mt-6 max-w-[280px]">
          The gym, but everyone's watching.
        </Text>
        <Button className="mt-10" onPress={() => router.push("/sign-in")}>
          Start
        </Button>
      </View>
    </Screen>
  );
}
