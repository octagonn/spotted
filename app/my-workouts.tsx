import { appAlert } from "@/components/ui/AppDialog";
import { useRouter, type Href } from "expo-router";
import { ChevronRight, Dumbbell, Flame, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonWorkoutRow } from "@/components/ui/Skeleton";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useUserLifts } from "@/hooks/queries/useUserLifts";
import { deriveExerciseBests, isRepsGraded, useDeleteWorkout, useWorkouts, type WorkoutRow } from "@/hooks/queries/useWorkouts";
import { BASE_LIBRARY, fmtClock, isCardioItem } from "@/lib/workoutLibrary";
import { relDay } from "@/lib/relDay";
import { showToast } from "@/stores/ui";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const DISP = "Geist_700Bold";
const NUM = "GeistMono_500Medium";
const CARDIO = "#FF8A4C";
const CARDIO_TINT = "rgba(255,138,76,0.14)";

function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        { fontFamily: "Geist_600SemiBold", fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: tokens.text.tertiary },
        style
      ]}
    >
      {children}
    </Text>
  );
}

/** Pulsing live dot (spec `.dot` / prototype `blink`). */
function PulseDot({ color = colors.white, size = 8 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

function InProgressCard({ onResume }: { onResume: () => void }) {
  const session = useWorkoutSession();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = session.startedAt ? Math.max(0, Math.floor((nowMs - session.startedAt) / 1000)) : 0;

  let vol = 0;
  let sets = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      sets += 1;
      if (ex.kind === "lift") vol += (s as { w: number; r: number }).w * (s as { w: number; r: number }).r;
    }
  }
  const exCount = session.exercises.length;
  const hasLift = session.exercises.some((e) => e.kind === "lift");
  const hasCardio = session.exercises.some((e) => e.kind === "cardio");
  const title =
    exCount === 0
      ? "New workout"
      : hasLift && hasCardio
        ? "Mixed workout"
        : hasCardio
          ? "Cardio session"
          : "Lifting session";
  const meta =
    exCount === 0
      ? "Tap to add your first exercise"
      : `${vol > 0 ? `${vol.toLocaleString()} lb · ` : ""}${sets} ${sets === 1 ? "set" : "sets"} · ${exCount} ${exCount === 1 ? "exercise" : "exercises"}`;

  return (
    <Pressable onPress={onResume} style={{ marginHorizontal: 18, marginBottom: 12 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: "rgba(232,180,76,0.4)",
          backgroundColor: tokens.accent.goldSubtle,
          borderRadius: radius.lg,
          padding: 18
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot color={tokens.accent.gold} size={9} />
            <Text style={{ fontFamily: DISP, fontSize: 12, letterSpacing: 1.5, color: tokens.accent.gold }}>
              IN PROGRESS · <Text style={{ fontFamily: NUM }}>{fmtClock(elapsed)}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: DISP, fontSize: 14, color: tokens.accent.gold }}>Resume</Text>
            <ChevronRight size={17} color={tokens.accent.gold} strokeWidth={2.2} />
          </View>
        </View>
        <Text style={{ marginTop: 12, fontFamily: DISP, fontSize: 20, color: tokens.text.primary }}>{title}</Text>
        <Text style={{ marginTop: 3, fontFamily: NUM, fontSize: 13.5, color: tokens.text.secondary }}>{meta}</Text>
      </View>
    </Pressable>
  );
}

/**
 * My Workouts — history + personal records. Used to be the far-left segment
 * of the dumbbell tab; that tab is Communities now and this screen opens
 * from the profile ("My Workouts" button above the streak calendar).
 */
export default function MyWorkoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile();
  const myId = profile.data?.id ?? null;
  const workouts = useWorkouts(myId);
  const userLifts = useUserLifts(myId);
  const sessionActive = useWorkoutSession((s) => s.active);
  // Sub-tab: history vs the full personal-records list.
  const [workoutsTab, setWorkoutsTab] = useState("Workouts");
  const deleteWorkout = useDeleteWorkout();

  // WHOOP-style Personal Records strip: best per exercise from workout
  // history + canonical lifts, heaviest first (reps/cardio bests at the end).
  const personalRecords = useMemo(() => {
    const bests = deriveExerciseBests(workouts.data, userLifts.data);
    const cardioNames = new Set(BASE_LIBRARY.filter(isCardioItem).map((l) => l.name));
    return Object.entries(bests)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => {
        const unit = cardioNames.has(name) ? "mi" : isRepsGraded(name) ? "reps" : "lbs";
        return { name, value, unit };
      })
      .sort((a, b) => {
        if (a.unit === "lbs" && b.unit !== "lbs") return -1;
        if (a.unit !== "lbs" && b.unit === "lbs") return 1;
        return b.value - a.value;
      });
  }, [workouts.data, userLifts.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="My Workouts" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6 }}>
            <Button icon={<Plus size={16} color={colors.black} />} onPress={() => router.push("/workout" as Href)}>
              Start a workout
            </Button>
          </View>

          {/* Workout history vs the FULL personal-records list (own tab). */}
          <Segmented options={["Workouts", "Records"]} value={workoutsTab} onChange={setWorkoutsTab} />

          {workoutsTab === "Records" ? (
            personalRecords.length > 0 ? (
              <View style={{ paddingHorizontal: 18, paddingTop: 10, gap: 8 }}>
                {personalRecords.map((pr) => (
                  <View
                    key={pr.name}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 10,
                      borderRadius: 16,
                      backgroundColor: tokens.bg.raised,
                      borderWidth: 1,
                      borderColor: tokens.border.default
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: tokens.bg.subtle,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {pr.unit === "mi" ? (
                        <Flame size={18} color={colors.white} strokeWidth={1.8} />
                      ) : (
                        <Dumbbell size={18} color={colors.white} strokeWidth={1.8} />
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}
                    >
                      {pr.name}
                    </Text>
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 20, color: colors.white }}>
                      {pr.value}
                      <Text style={{ fontFamily: "Geist_500Medium", fontSize: 12, color: colors.fog }}> {pr.unit}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingHorizontal: 40, paddingTop: 40 }}>
                <Text style={{ fontSize: 13.5, lineHeight: 19, color: colors.fog, textAlign: "center" }}>
                  No records yet — finish a workout and your bests land here.
                </Text>
              </View>
            )
          ) : null}

          {workoutsTab === "Workouts" ? (
            <>
          <View style={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 10 }}>
            <Micro style={{ letterSpacing: 3 }}>Recent</Micro>
          </View>
          {sessionActive ? <InProgressCard onResume={() => router.push("/workout" as Href)} /> : null}
          {workouts.isLoading ? (
            <View style={{ paddingVertical: 10 }}>
              <SkeletonWorkoutRow />
              <SkeletonWorkoutRow />
              <SkeletonWorkoutRow />
            </View>
          ) : (workouts.data ?? []).length === 0 && !sessionActive ? (
            <View style={{ alignItems: "center", paddingHorizontal: 40, paddingTop: 40 }}>
              <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
                <Dumbbell size={38} color={tokens.accent.gold} strokeWidth={1.7} />
              </View>
              <Text style={{ marginTop: 22, fontFamily: DISP, fontSize: 22, color: colors.white, textAlign: "center" }}>
                No workouts logged yet
              </Text>
              <Text style={{ marginTop: 10, fontSize: 14.5, lineHeight: 21, color: colors.fog, textAlign: "center", maxWidth: 280 }}>
                Start a workout to log your lifts and cardio. PRs earn trophies.
              </Text>
            </View>
          ) : (
            (workouts.data ?? []).map((w) => <WorkoutHistoryCard key={w.id} workout={w} />)
          )}
            </>
          ) : null}
      </ScrollView>
    </View>
  );

  function WorkoutHistoryCard({ workout }: { workout: WorkoutRow }) {
    const cardioOnly = workout.totalVolume === 0 && workout.cardioMinutes > 0;
    const timeLabel = new Date(workout.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const prCount = workout.prs.length;
    // Long-press: edit or delete straight from the tab. Neither touches the
    // daily post — attached workouts are forked/hidden, never removed from it.
    const editWorkout = () => router.push(`/workout?edit=${workout.id}` as Href);
    const confirmDelete = () =>
      appAlert(
        "Delete workout?",
        workout.postId
          ? "It leaves your workout history — your daily post keeps it. Trophies stay."
          : "It disappears from your history. Trophies stay.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              deleteWorkout.mutate(workout.id, {
                onSuccess: () => showToast("Workout deleted"),
                onError: () => showToast("Couldn't delete — try again")
              })
          }
        ]
      );
    const openActions = () => {
      appAlert(workout.name, undefined, [
        { text: "Edit workout", onPress: editWorkout },
        { text: "Delete from history", style: "destructive", onPress: confirmDelete },
        { text: "Cancel", style: "cancel" }
      ]);
    };
    return (
      <Pressable
        onPress={() => router.push(`/workout/${workout.id}` as Href)}
        onLongPress={openActions}
        accessibilityActions={[
          { name: "edit", label: "Edit workout" },
          { name: "delete", label: "Delete from history" }
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "edit") editWorkout();
          else if (event.nativeEvent.actionName === "delete") confirmDelete();
        }}
        style={{ marginHorizontal: 18, marginBottom: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            borderWidth: 1,
            borderColor: colors.iron,
            backgroundColor: tokens.bg.raised,
            borderRadius: radius.lg,
            padding: 16
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              backgroundColor: cardioOnly ? CARDIO_TINT : tokens.accent.goldSubtle,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {cardioOnly ? (
              <Flame size={20} color={CARDIO} strokeWidth={1.7} />
            ) : (
              <Dumbbell size={21} color={tokens.accent.gold} strokeWidth={1.8} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 16, color: colors.white }}>
                {workout.name}
              </Text>
              {prCount > 0 ? (
                <View style={{ backgroundColor: tokens.accent.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: DISP, fontSize: 10, letterSpacing: 1, color: colors.black }}>
                    {prCount} {prCount === 1 ? "PR" : "PRs"}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ marginTop: 2, fontFamily: NUM, fontSize: 12, color: colors.fog }}>
              {`${relDay(workout.startedAt)} · ${timeLabel} · ${workout.exerciseCount} ${workout.exerciseCount === 1 ? "exercise" : "exercises"}`}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontFamily: NUM, fontSize: 17, color: colors.white }}>
                {workout.totalSets > 0 ? `${workout.totalSets}` : `${workout.exerciseCount}`}
              </Text>
              <Micro style={{ marginTop: 1, letterSpacing: 0.5 }}>
                {workout.totalSets > 0 ? (workout.totalSets === 1 ? "set" : "sets") : "activities"}
              </Micro>
            </View>
            <ChevronRight size={17} color={colors.slate} />
          </View>
        </View>
      </Pressable>
    );
  }
}
