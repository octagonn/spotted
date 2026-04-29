import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

const rows = [
  ["Account", "/settings/account"],
  ["Privacy", "/settings/privacy"],
  ["Spotted+", "/settings/plus"]
];

export default function SettingsScreen() {
  return (
    <Screen>
      <Text variant="display-sm">SETTINGS</Text>
      <View className="mt-8 gap-3">
        {rows.map(([label, href]) => (
          <Button key={label} variant="ghost" onPress={() => router.push(href)}>
            {label}
          </Button>
        ))}
      </View>
    </Screen>
  );
}
