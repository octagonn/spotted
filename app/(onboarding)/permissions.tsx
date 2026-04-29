import { router } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

export default function PermissionsScreen() {
  return (
    <Screen>
      <View className="min-h-[640px] justify-end">
        <Text variant="display-md">LET IT WATCH.</Text>
        <Text variant="italic" className="mt-5">
          Location verifies check-ins. Notifications make skipping public enough to matter.
        </Text>
        <View className="mt-10 gap-3">
          <View className="border border-iron bg-ink p-4">
            <Text variant="body-strong">Location Always</Text>
            <Text variant="caption" className="mt-1">
              Geofencing for home gym plus nearest joined gyms.
            </Text>
          </View>
          <View className="border border-iron bg-ink p-4">
            <Text variant="body-strong">Notifications</Text>
            <Text variant="caption" className="mt-1">
              Views, streak breaks, DMs, and gym arrivals.
            </Text>
          </View>
        </View>
        <Button className="mt-8" onPress={() => router.replace("/feed")}>
          Finish
        </Button>
      </View>
    </Screen>
  );
}
