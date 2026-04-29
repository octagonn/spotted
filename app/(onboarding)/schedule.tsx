import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { MuscleChip } from "@/components/MuscleChip";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { MuscleGroup } from "@/types/domain";

const muscles: MuscleGroup[] = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Push", "Pull", "Cardio", "Rest"];
const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function ScheduleScreen() {
  const [selected, setSelected] = useState<MuscleGroup[]>(["Push", "Pull", "Legs"]);

  return (
    <Screen>
      <Text variant="display-md">LOCK THE WEEK.</Text>
      <Text variant="italic" className="mt-5">
        Set the days your friends get to hold you to.
      </Text>
      <View className="mt-10 gap-2">
        {days.map((day, index) => (
          <View key={day} className="flex-row items-center border border-iron bg-ink p-3">
            <Text variant="micro" className="w-14 text-white">
              {day}
            </Text>
            <Text variant="body">{index === 6 ? "Rest" : index % 2 === 0 ? "Push" : "Pull"}</Text>
          </View>
        ))}
      </View>
      <View className="mt-8 flex-row flex-wrap gap-2">
        {muscles.map((muscle) => (
          <MuscleChip
            key={muscle}
            muscle={muscle}
            selected={selected.includes(muscle)}
            onPress={() => setSelected((current) => (current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle]))}
          />
        ))}
      </View>
      <Button className="mt-8" onPress={() => router.push("/permissions")}>
        Continue
      </Button>
    </Screen>
  );
}
