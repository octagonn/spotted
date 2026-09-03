import { useLocalSearchParams, useRouter } from "expo-router";
import { Bookmark, Pencil, Repeat, SquarePen, Trash2, Trophy } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SkeletonHeaderDetail, SkeletonWorkoutRow } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { Text } from "@/components/ui/Text";
import { ExerciseIcon, exerciseKind } from "@/components/workout/ExerciseIcon";
import { PrBadge } from "@/components/workout/PrBadge";
import { useSaveRoutine } from "@/hooks/queries/useRoutines";
import {
  useDeleteWorkout,
  useRenameWorkout,
  useWorkout,
  type CardioSet,
  type LiftSet
} from "@/hooks/queries/useWorkouts";
import { relDay } from "@/lib/relDay";
import { repeatableExercises } from "@/lib/repeatWorkout";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Read-only session detail — self or friend (RLS). */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const workout = useWorkout(id);
  const myId = useAuthStore((state) => state.userId);
  const saveRoutine = useSaveRoutine();
  const rename = useRenameWorkout();
  const deleteWorkout = useDeleteWorkout();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const confirmDelete = (workoutId: string, attachedToPost: boolean) => {
    appAlert(
      "Delete workout?",
      attachedToPost
        ? "It leaves your workout history — your daily post keeps it. Trophies you earned from it stay."
        : "It disappears from your history. Trophies you earned from it stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteWorkout.mutate(workoutId, {
              onSuccess: () => {
                showToast("Workout deleted");
                router.back();
              },
              onError: () => showToast("Couldn't delete — try again")
            })
        }
      ]
    );
  };

  if (workout.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + space[3] }}>
        <SkeletonHeaderDetail />
        <SkeletonWorkoutRow />
        <SkeletonWorkoutRow />
        <SkeletonWorkoutRow />
      </View>
    );
  }
  if (!workout.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + space[3] }}>
        <View style={{ paddingHorizontal: space[4] }}>
          <BackButton />
        </View>
        <EmptyState title="This workout is no longer available." center />
      </View>
    );
  }

  const w = workout.data;
  const mine = w.userId === myId;
  const timeLabel = new Date(w.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const when = `${relDay(w.startedAt)} · ${timeLabel}`;

  const commitRename = () => {
    setEditing(false);
    const next = nameDraft.trim();
    if (next && next !== w.name) {
      rename.mutate({ workoutId: w.id, name: next }, { onError: () => showToast("Couldn't rename — try again") });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* header: back · name (owner: tap to rename) · edit · delete */}
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingHorizontal: space[4],
          paddingBottom: space[3],
          borderBottomWidth: 1,
          borderBottomColor: tokens.border.default
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <BackButton />
          <View style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <TextInput
                autoFocus
                value={nameDraft}
                onChangeText={setNameDraft}
                maxLength={60}
                onSubmitEditing={commitRename}
                onBlur={commitRename}
                accessibilityLabel="Workout name"
                style={{
                  fontFamily: "Geist_700Bold",
                  fontSize: 20,
                  color: tokens.text.primary,
                  borderBottomWidth: 1,
                  borderBottomColor: tokens.border.strong,
                  paddingVertical: 2
                }}
              />
            ) : (
              <Pressable
                disabled={!mine}
                haptic="none"
                accessibilityLabel={mine ? "Rename workout" : w.name}
                onPress={() => {
                  setNameDraft(w.name);
                  setEditing(true);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
              >
                <Text variant="heading" numberOfLines={1} className="flex-shrink">
                  {w.name}
                </Text>
                {mine ? <Pencil size={13} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} /> : null}
              </Pressable>
            )}
            <Text variant="meta" className="mt-[2px]">
              {when}
            </Text>
          </View>
          {mine ? (
            <>
              <IconButton
                variant="plain"
                size={36}
                icon={<SquarePen size={icon.size.sm} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />}
                accessibilityLabel="Edit workout"
                onPress={() => router.push(`/workout?edit=${w.id}`)}
              />
              <IconButton
                variant="plain"
                size={36}
                icon={<Trash2 size={icon.size.sm} color={tokens.status.danger} strokeWidth={icon.stroke.regular} />}
                accessibilityLabel="Delete workout"
                haptic="warning"
                onPress={() => confirmDelete(w.id, Boolean(w.postId))}
              />
            </>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: space[4], paddingBottom: insets.bottom + space[6] }}>
        {/* stats — one flat row, no cards */}
        <View style={{ flexDirection: "row", paddingHorizontal: space[4] }}>
          <Stat value={w.totalSets} label="Sets" size="sm" />
          <Stat value={w.exerciseCount} label={w.exerciseCount === 1 ? "Exercise" : "Exercises"} size="sm" />
          <Stat value={Math.round(w.durationSeconds / 60)} unit="min" label="Duration" size="sm" />
          <Stat value={w.prs.length} label={w.prs.length === 1 ? "PR" : "PRs"} size="sm" />
        </View>

        {/* PRs earned — achievement, so this is where gold lives */}
        {w.prs.length > 0 ? (
          <View style={{ marginTop: space[6], paddingHorizontal: space[4] }}>
            <SectionLabel style={{ marginBottom: space[2] }}>Personal records</SectionLabel>
            <View style={{ gap: space[2] }}>
              {w.prs.map((pr) => (
                <View
                  key={pr.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[3],
                    backgroundColor: tokens.accent.goldSubtle,
                    borderRadius: radius.md,
                    paddingVertical: space[3],
                    paddingHorizontal: space[4]
                  }}
                >
                  <Trophy size={icon.size.md} color={tokens.accent.gold} strokeWidth={icon.stroke.thin} />
                  <View style={{ flex: 1 }}>
                    <Text variant="username">{pr.name}</Text>
                    <Text variant="meta" className="text-gold">
                      {pr.was}
                    </Text>
                  </View>
                  <Text variant="numeral">{pr.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* exercises + sets: one raised card per exercise, flat set rows inside */}
        <View style={{ marginTop: space[6], paddingHorizontal: space[4] }}>
          <SectionLabel style={{ marginBottom: space[2] }}>Exercises</SectionLabel>
          <View style={{ gap: space[3] }}>
            {w.exercises.map((ex) => {
              const isCardio = ex.kind === "cardio";
              const logged = ex.sets.filter((s) => s.done);
              const sets = logged.length ? logged : ex.sets;
              return (
                <View
                  key={ex.id}
                  style={{ backgroundColor: tokens.bg.raised, borderRadius: radius.md, padding: space[3] }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                    <ExerciseIcon kind={exerciseKind(ex.kind, ex.muscle)} size={40} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flex: 1, minWidth: 0 }}>
                      <Text variant="username" numberOfLines={1} className="flex-shrink">
                        {ex.name}
                      </Text>
                      {sets.some((s) => s.pr) ? <PrBadge /> : null}
                    </View>
                  </View>
                  <View style={{ marginTop: space[2] }}>
                    {sets.map((s, i) => {
                      const pr = Boolean(s.pr);
                      const text = isCardio
                        ? `${(s as CardioSet).mi} mi · ${(s as CardioSet).min} min`
                        : `${(s as LiftSet).w} lb × ${(s as LiftSet).r}`;
                      const sub = isCardio
                        ? `${(s as CardioSet).mi > 0 ? ((s as CardioSet).min / (s as CardioSet).mi).toFixed(1) : "0"} min/mi`
                        : `${(s as LiftSet).w * (s as LiftSet).r} lb`;
                      return (
                        <View
                          key={s.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: space[3],
                            paddingVertical: space[2],
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: tokens.border.subtle
                          }}
                        >
                          <Text variant="numeral-sm" className="w-6 text-fog">
                            {String(i + 1)}
                          </Text>
                          <Text variant="body-sm-strong" className="flex-1">
                            {text}
                          </Text>
                          {pr ? <PrBadge /> : null}
                          <Text variant="meta" className="font-mono">
                            {sub}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
            {w.exercises.length === 0 ? (
              <EmptyState title="No exercises were logged." center paddingTop={space[2]} />
            ) : null}
          </View>
        </View>

        {/* Your own workouts only: a friend's workout is a record, not a routine you can start. */}
        {mine && w.exercises.length > 0 ? (
          <View style={{ marginTop: space[6], paddingHorizontal: space[4], gap: space[2] }}>
            <Button
              icon={<Repeat size={icon.size.xs} color={colors.black} strokeWidth={icon.stroke.bold} />}
              onPress={() => router.push(`/workout?repeat=${w.id}`)}
            >
              Do this workout again
            </Button>
            <Button
              variant="ghost"
              icon={<Bookmark size={icon.size.xs} color={colors.bone} strokeWidth={icon.stroke.regular} />}
              disabled={saveRoutine.isPending}
              loading={saveRoutine.isPending}
              onPress={() => saveRoutine.mutate({ name: w.name, exercises: repeatableExercises(w.exercises) })}
            >
              Save as routine
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
