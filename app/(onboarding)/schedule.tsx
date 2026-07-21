import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { MuscleChip } from "@/components/MuscleChip";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { advanceOnboarding } from "@/lib/onboarding";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { MuscleGroup } from "@/types/domain";

const muscleOptions: MuscleGroup[] = ["Push", "Pull", "Legs", "Cardio", "Rest"];
const days: { label: string; index: number }[] = [
  { label: "MON", index: 1 },
  { label: "TUE", index: 2 },
  { label: "WED", index: 3 },
  { label: "THU", index: 4 },
  { label: "FRI", index: 5 },
  { label: "SAT", index: 6 },
  { label: "SUN", index: 0 }
];

const defaults: Record<number, MuscleGroup> = {
  1: "Push",
  2: "Pull",
  3: "Legs",
  4: "Push",
  5: "Pull",
  6: "Legs",
  0: "Rest"
};

export default function ScheduleScreen() {
  const userId = useAuthStore((state) => state.userId);
  const [plan, setPlan] = useState<Record<number, MuscleGroup>>(defaults);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  async function handleNext() {
    if (!isSupabaseConfigured || !userId) {
      await advanceOnboarding(userId, "complete");
      router.replace("/feed");
      return;
    }
    setSubmitting(true);
    try {
      const rows = days.map((day) => ({
        user_id: userId,
        day_of_week: day.index,
        muscle_groups: [plan[day.index]]
      }));
      const { error } = await supabase
        .from("workout_schedule")
        .upsert(rows, { onConflict: "user_id,day_of_week" });
      if (error) throw error;
      await advanceOnboarding(userId, "complete");
      router.replace("/feed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save schedule.";
      Alert.alert("Couldn't save", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
        <Text variant="micro" className="text-mist">
          STEP 6 OF 6
        </Text>
      </View>
      <Text variant="display-md" className="mt-6">
        LOCK THE WEEK.
      </Text>
      <Text variant="italic" className="mt-3">
        Set the days your friends get to hold you to.
      </Text>

      <View className="mt-8 gap-2">
        {days.map((day) => {
          const muscle = plan[day.index];
          const active = activeDay === day.index;
          return (
            <Pressable
              key={day.label}
              className={`flex-row items-center rounded-card border p-4 ${
                active ? "border-white bg-glass-strong" : "border-hairline-strong bg-glass"
              }`}
              onPress={() => setActiveDay(day.index)}
            >
              <Text variant="micro" className={`w-14 ${active ? "text-white" : "text-mist"}`}>
                {day.label}
              </Text>
              <Text variant="body-strong" className={active ? "text-white" : "text-mist"}>
                {muscle}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="micro" className="mt-8 text-mist">
        SET {days.find((d) => d.index === activeDay)?.label}
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {muscleOptions.map((muscle) => (
          <MuscleChip
            key={muscle}
            muscle={muscle}
            selected={plan[activeDay] === muscle}
            onPress={() => setPlan((prev) => ({ ...prev, [activeDay]: muscle }))}
          />
        ))}
      </View>

      <Button className="mt-10" onPress={handleNext} loading={submitting}>
        Finish
      </Button>
    </Screen>
  );
}
