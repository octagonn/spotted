import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

export default function SettingsScreen() {
  return (
    <Screen>
      <BackButton fallback="/(tabs)/profile" style={{ marginBottom: 18 }} />
      <Text variant="display-sm">SETTINGS</Text>
      <View className="mt-8 gap-3">
        <Button variant="ghost" onPress={() => router.push("/settings/account")}>
          Account
        </Button>
        <Button variant="ghost" onPress={() => router.push("/settings/privacy")}>
          Privacy
        </Button>
      </View>
    </Screen>
  );
}
