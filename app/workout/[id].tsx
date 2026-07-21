import { useLocalSearchParams } from "expo-router";
import { Dumbbell, Flame } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { useWorkout, type CardioSet, type LiftSet, type WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { fmtClock, fmtMiles, fmtWeight } from "@/lib/workoutLibrary";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const DISP = "Geist_700Bold";
const NUM = "GeistMono_500Medium";

function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text style={[{ fontFamily: "Geist_600SemiBold", fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: tokens.text.tertiary }, style]}>
      {children}
    </Text>
  );
}

/** Read-only view of a logged workout (history) — self or a friend's (RLS). */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkout(id);

  if (workout.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg.base, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!workout.data) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg.base }}>
        <PanelHeader title="Workout" />
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>This workout is no longer available.</Text>
      </View>
    );
  }

  const w = workout.data;
  const when = new Date(w.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const lifts = w.exercises.filter((e) => e.kind === "lift");
  const cardio = w.exercises.filter((e) => e.kind === "cardio");

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.base }}>
      <PanelHeader title={w.name} sub={when} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* Summary stats */}
        <View style={{ flexDirection: "row", gap: 10, paddingTop: 8, paddingBottom: 16 }}>
          <Stat value={w.totalVolume.toLocaleString()} label="Volume · lb" />
          <Stat value={`${w.totalSets}`} label="Sets" />
          {w.cardioMinutes > 0 ? <Stat value={`${w.cardioMinutes}`} label="Cardio · min" /> : null}
          <Stat value={fmtClock(w.durationSeconds)} label="Duration" />
        </View>

        {lifts.length > 0 ? <Section title="Weightlifting" Icon={Dumbbell} exercises={lifts} /> : null}
        {cardio.length > 0 ? <Section title="Cardio" Icon={Flame} exercises={cardio} /> : null}
        {w.exercises.length === 0 ? (
          <Text style={{ paddingTop: 30, textAlign: "center", fontSize: 13, color: colors.fog }}>No exercises were logged.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.raised, borderWidth: 1, borderColor: tokens.border.default, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 10 }}>
      <Text style={{ fontFamily: NUM, fontSize: 18, color: tokens.text.primary }}>{value}</Text>
      <Micro style={{ marginTop: 4 }}>{label}</Micro>
    </View>
  );
}

function Section({ title, Icon, exercises }: { title: string; Icon: typeof Dumbbell; exercises: WorkoutExercise[] }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingBottom: 8 }}>
        <Icon size={15} color={tokens.text.primary} strokeWidth={1.9} />
        <Text style={{ fontFamily: DISP, fontSize: 16, color: tokens.text.primary }}>{title}</Text>
      </View>
      {exercises.map((ex) => {
        const isCardio = ex.kind === "cardio";
        const inc = isCardio && ex.hasInc;
        const done = ex.sets.filter((s) => s.done);
        return (
          <View key={ex.id} style={{ marginBottom: 12, backgroundColor: tokens.bg.raised, borderWidth: 1, borderColor: tokens.border.default, borderRadius: radius.md }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 16, color: tokens.text.primary }}>{ex.name}</Text>
              <Micro style={{ marginTop: 2 }}>{ex.muscle}</Micro>
            </View>
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 4 }}>
              <Micro style={{ width: 32 }}>{isCardio ? "Int" : "Set"}</Micro>
              <View style={{ flex: 1, alignItems: "center" }}><Micro>{isCardio ? "Min" : "Lb"}</Micro></View>
              <View style={{ flex: 1, alignItems: "center" }}><Micro>{isCardio ? "Mi" : "Reps"}</Micro></View>
              {inc ? <View style={{ flex: 1, alignItems: "center" }}><Micro>Inc %</Micro></View> : null}
            </View>
            {(done.length ? done : ex.sets).map((s, i) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
                <Text style={{ width: 32, fontFamily: NUM, fontSize: 15, color: tokens.text.tertiary }}>{i + 1}</Text>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontFamily: NUM, fontSize: 16, color: tokens.text.primary }}>
                    {isCardio ? (s as CardioSet).min : fmtWeight((s as LiftSet).w)}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontFamily: NUM, fontSize: 16, color: tokens.text.primary }}>
                    {isCardio ? fmtMiles((s as CardioSet).mi, true) : (s as LiftSet).r}
                  </Text>
                </View>
                {inc ? (
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ fontFamily: NUM, fontSize: 16, color: tokens.text.primary }}>{fmtMiles((s as CardioSet).inc ?? 0, false)}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
