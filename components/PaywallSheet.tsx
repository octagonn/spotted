import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";

type PaywallSheetProps = {
  onSubscribe?: () => void;
};

const bullets = [
  "See every viewer, unblurred. Names included.",
  "3 freeze tokens a month. One bad week won't kill your streak.",
  "Travel Mode. Full features at every gym, not just home.",
  "Gold flame. Gold check. Gold reactions."
];

export function PaywallSheet({ onSubscribe }: PaywallSheetProps) {
  return (
    <Sheet className="p-6">
      <Text variant="display-md">GO GOLD.</Text>
      <Text variant="italic" className="mt-4">
        Spotted+ shows you who's really watching.
      </Text>
      <View className="mt-8 gap-4">
        {bullets.map((bullet) => (
          <View key={bullet} className="border-t border-iron pt-4">
            <Text variant="body">{bullet}</Text>
          </View>
        ))}
      </View>
      <Button className="mt-8" onPress={onSubscribe}>
        Start 7 days free
      </Button>
      <Text variant="caption" className="mt-4">
        $4.99/mo or $34.99/yr. Cancel anytime.
      </Text>
    </Sheet>
  );
}
