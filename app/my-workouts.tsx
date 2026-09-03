import { useRouter, type Href } from "expo-router";
import { Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EMPTY_ART } from "@/lib/emptyStateArt";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonWorkoutRow } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { ExerciseIcon } from "@/components/workout/ExerciseIcon";
import { InProgressCard } from "@/components/workout/InProgressCard";
import { WorkoutHistoryCard } from "@/components/workout/WorkoutHistoryCard";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useUserLifts } from "@/hooks/queries/useUserLifts";
import {
  deriveExerciseBests,
  isRepsGraded,
  useDeleteWorkout,
  useWorkouts,
  type WorkoutRow
} from "@/hooks/queries/useWorkouts";
import { BASE_LIBRARY, isCardioItem } from "@/lib/workoutLibrary";
import { showToast } from "@/stores/ui";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** My Workouts — history + personal records. Opens from the profile. */
export default function MyWorkoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useMyProfile();
  const myId = profile.data?.id ?? null;
  const workouts = useWorkouts(myId);
  const userLifts = useUserLifts(myId);
  const sessionActive = useWorkoutSession((s) => s.active);
  const [tab, setTab] = useState("Workouts");
  const deleteWorkout = useDeleteWorkout();

  // Personal records: best per exercise from history + canonical lifts,
  // heaviest first (reps/cardio bests at the end).
  const personalRecords = useMemo(() => {
    const bests = deriveExerciseBests(workouts.data, userLifts.data);
    const cardioNames = new Set(BASE_LIBRARY.filter(isCardioItem).map((l) => l.name));
    return Object.entries(bests)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => {
        const unit = cardioNames.has(name) ? "mi" : isRepsGraded(name) ? "reps" : "lb";
        return { name, value, unit };
      })
      .sort((a, b) => {
        if (a.unit === "lb" && b.unit !== "lb") return -1;
        if (a.unit !== "lb" && b.unit === "lb") return 1;
        return b.value - a.value;
      });
  }, [workouts.data, userLifts.data]);

  // Long-press: edit or delete straight from the list. Neither touches the
  // daily post — attached workouts are forked/hidden, never removed from it.
  const editWorkout = (w: WorkoutRow) => router.push(`/workout?edit=${w.id}` as Href);
  const confirmDelete = (w: WorkoutRow) =>
    appAlert(
      "Delete workout?",
      w.postId
        ? "It leaves your workout history — your daily post keeps it. Trophies stay."
        : "It disappears from your history. Trophies stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteWorkout.mutate(w.id, {
              onSuccess: () => showToast("Workout deleted"),
              onError: () => showToast("Couldn't delete — try again")
            })
        }
      ]
    );
  const openActions = (w: WorkoutRow) =>
    appAlert(w.name, undefined, [
      { text: "Edit workout", onPress: () => editWorkout(w) },
      { text: "Delete from history", style: "destructive", onPress: () => confirmDelete(w) },
      { text: "Cancel", style: "cancel" }
    ]);

  const rows = workouts.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="My Workouts" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}>
        <View style={{ paddingHorizontal: space[4], paddingTop: space[1], paddingBottom: space[2] }}>
          <Button
            icon={<Plus size={icon.size.xs} color={colors.black} />}
            onPress={() => router.push("/workout" as Href)}
          >
            Start a workout
          </Button>
        </View>

        <Segmented options={["Workouts", "Records"]} value={tab} onChange={setTab} />

        {tab === "Records" ? (
          personalRecords.length > 0 ? (
            <View style={{ paddingHorizontal: space[4], paddingTop: space[2], gap: space[2] }}>
              {personalRecords.map((pr) => (
                <View
                  key={pr.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[3],
                    padding: space[3],
                    borderRadius: radius.md,
                    backgroundColor: tokens.bg.raised
                  }}
                >
                  <ExerciseIcon kind={pr.unit === "mi" ? "cardio" : "lift"} size={40} />
                  <Text variant="username" numberOfLines={1} className="flex-1">
                    {pr.name}
                  </Text>
                  <Text variant="numeral">
                    {String(pr.value)}
                    <Text variant="numeral-sm" className="text-fog">
                      {` ${pr.unit}`}
                    </Text>
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              art={EMPTY_ART.trophy}
              title="No records yet"
              body="Finish a workout and your bests land here."
              center
            />
          )
        ) : (
          <>
            <View style={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[2] }}>
              <SectionLabel>Recent</SectionLabel>
            </View>
            {sessionActive ? <InProgressCard onResume={() => router.push("/workout" as Href)} /> : null}
            {workouts.isLoading ? (
              <View style={{ paddingVertical: space[2] }}>
                <SkeletonWorkoutRow />
                <SkeletonWorkoutRow />
                <SkeletonWorkoutRow />
              </View>
            ) : rows.length === 0 && !sessionActive ? (
              <EmptyState
                art={EMPTY_ART.dumbbell}
                title="No workouts logged yet"
                body="Start a workout to log your lifts and cardio. PRs earn trophies."
                center
              />
            ) : (
              rows.map((w) => (
                <WorkoutHistoryCard
                  key={w.id}
                  workout={w}
                  onPress={() => router.push(`/workout/${w.id}` as Href)}
                  onLongPress={() => openActions(w)}
                  onEdit={() => editWorkout(w)}
                  onDelete={() => confirmDelete(w)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
