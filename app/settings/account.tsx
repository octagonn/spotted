import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui/Text";

export default function AccountSettingsScreen() {
  return (
    <Screen>
      <Text variant="display-sm">ACCOUNT</Text>
      <View className="mt-8 border border-iron bg-ink p-4">
        <Text variant="body-strong">octavio</Text>
        <Text variant="caption" className="mt-2">
          Sign out, username changes, and account deletion live here.
        </Text>
      </View>
    </Screen>
  );
}
