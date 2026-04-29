import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { StreakFlame } from "@/components/StreakFlame";
import { Text } from "@/components/ui/Text";
import { useStreak } from "@/hooks/queries/useStreak";

const days = Array.from({ length: 30 }, (_, index) => index);

export default function StreakModal() {
  const streak = useStreak();
  const current = streak.data?.current_streak ?? 0;

  return (
    <Screen>
      <View className="min-h-[540px] justify-end">
        <StreakFlame size="lg" />
        <Text variant="display-xl" className="mt-8">
          {current}
        </Text>
        <Text variant="micro" className="mt-2 text-white">
          DAY STREAK
        </Text>
      </View>
      <View className="mt-8 border border-iron bg-ink p-4">
        <Text variant="micro">LAST 30 DAYS</Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {days.map((day) => (
            <View key={day} className={`h-9 w-9 items-center justify-center border ${day < current ? "border-white bg-white" : "border-iron bg-black"}`}>
              <Text variant="micro" className={day < current ? "text-black" : "text-fog"}>
                {day < current ? "✓" : "×"}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View className="mt-4 border border-iron bg-ink p-4">
        <Text variant="body-strong">Freeze tokens: {streak.data?.freeze_tokens ?? 0}</Text>
        <Text variant="caption" className="mt-2 italic">
          If you miss tomorrow's leg day, 2 friends will be notified.
        </Text>
      </View>
    </Screen>
  );
}
