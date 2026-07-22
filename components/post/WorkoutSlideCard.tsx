import { Dumbbell, Flame, Trophy } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

import type { CardioSet, LiftSet, WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { fmtClock } from "@/lib/workoutLibrary";
import { colors } from "@/theme/colors";

const CARDIO = "#FF8A4C";

export type FeedWorkout = {
  id: string;
  name: string;
  durationSeconds: number;
  exercises: WorkoutExercise[];
  /** True for a workout added AFTER the daily post (a "2nd workout today"). */
  isSecond?: boolean;
};

/**
 * A designed workout card for the feed daily-post stack (not a screenshot):
 * title/duration header, then every exercise with its sets as weight×reps
 * rows. Renders in the zinc/gold system; scrolls VERTICALLY within its slide
 * when a big session doesn't fit, so no truncation.
 */
export function WorkoutSlideCard({ workout }: { workout: FeedWorkout }) {
  let sets = 0;
  let cardioMin = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (!s.done) continue;
      sets += 1;
      if (ex.kind === "cardio") cardioMin += (s as CardioSet).min;
    }
  }

  return (
    <View style={{ width: "100%", aspectRatio: 3 / 3.6, backgroundColor: colors.ink, padding: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(232,180,76,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Dumbbell size={17} color={colors.gold} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: "Boldonse_400Regular", fontSize: 13, color: colors.white }}>
            {workout.name}
          </Text>
          <Text style={{ marginTop: 2, fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>
            {[
              `${sets} ${sets === 1 ? "set" : "sets"}`,
              cardioMin > 0 ? `${cardioMin} min cardio` : null,
              fmtClock(workout.durationSeconds)
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {workout.isSecond ? (
          <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.gold }}>
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 9, letterSpacing: 0.5, color: colors.gold }}>2ND TODAY</Text>
          </View>
        ) : null}
      </View>

      {/* Exercise table — scrolls within the slide when it overflows. */}
      <ScrollView
        style={{ flex: 1, marginTop: 14 }}
        showsVerticalScrollIndicator
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {workout.exercises.map((ex) => {
          const done = ex.sets.filter((s) => s.done);
          if (done.length === 0) return null;
          const anyPR = done.some((s) => s.pr);
          return (
            <View key={ex.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 }}>
                {ex.kind === "cardio" ? (
                  <Flame size={12} color={CARDIO} strokeWidth={2} />
                ) : (
                  <Dumbbell size={12} color={colors.gold} strokeWidth={2} />
                )}
                <Text style={{ flex: 1, fontFamily: "Geist_700Bold", fontSize: 13, color: colors.white }} numberOfLines={1}>
                  {ex.name}
                </Text>
                {anyPR ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Trophy size={11} color={colors.gold} strokeWidth={2} />
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 9.5, letterSpacing: 0.5, color: colors.gold }}>PR</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 3 }}>
                {done.map((s, i) => {
                  const text =
                    ex.kind === "lift"
                      ? `${(s as LiftSet).w} lb × ${(s as LiftSet).r}`
                      : `${(s as CardioSet).mi} mi · ${(s as CardioSet).min} min`;
                  return (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: s.pr ? "rgba(232,180,76,0.12)" : "rgba(255,255,255,0.03)"
                      }}
                    >
                      <Text style={{ width: 16, fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.fog }}>{i + 1}</Text>
                      <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.bone }}>{text}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
