import { View } from "react-native";
import { Check } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";

type GymBadgeProps = {
  gymName?: string | null;
  verified?: boolean;
};

export function GymBadge({ gymName, verified }: GymBadgeProps) {
  return (
    <View className="flex-row items-center gap-2">
      {verified ? (
        <View className="h-4 w-4 items-center justify-center border border-white bg-white">
          <Check color={colors.black} size={11} strokeWidth={3} />
        </View>
      ) : null}
      <Text variant="micro" className={verified ? "text-white" : "text-fog"}>
        {verified && gymName ? `VERIFIED AT ${gymName}` : gymName ?? "NOT AT A GYM"}
      </Text>
    </View>
  );
}
