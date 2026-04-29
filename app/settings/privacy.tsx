import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui/Text";

const options = [
  ["Ghost mode", "Hide your avatar from the gym map."],
  ["Discoverable", "Let people at your gym find you."],
  ["Schedule visibility", "Friends by default. Public if you mean it."],
  ["Arrival notifications", "Tell friends when you get to the gym."]
];

export default function PrivacySettingsScreen() {
  return (
    <Screen>
      <Text variant="display-sm">PRIVACY</Text>
      <View className="mt-8 gap-3">
        {options.map(([title, body]) => (
          <View key={title} className="border border-iron bg-ink p-4">
            <Text variant="body-strong">{title}</Text>
            <Text variant="caption" className="mt-2">
              {body}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
