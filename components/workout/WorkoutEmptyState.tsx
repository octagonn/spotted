import { Bookmark, Dumbbell, Pencil, Plus, Repeat, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Text } from "@/components/ui/Text";
import type { Routine } from "@/hooks/queries/useRoutines";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type RecentRoutine = { id: string; name: string; detail: string };

type WorkoutEmptyStateProps = {
  routines: Routine[];
  recent: RecentRoutine[];
  onAddExercises: () => void;
  onStartRoutine: (routineId: string) => void;
  onRenameRoutine: (routineId: string, name: string) => void;
  onDeleteRoutine: (routineId: string) => void;
  onRepeat: (workoutId: string) => void;
};

function RoutineRow({
  leading,
  title,
  sub,
  onPress,
  trailing,
  accessibilityLabel
}: {
  leading: React.ReactNode;
  title: React.ReactNode;
  sub: string;
  onPress: () => void;
  trailing?: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        marginBottom: space[2],
        borderRadius: radius.md,
        backgroundColor: tokens.bg.raised
      }}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        haptic="none"
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3] }}
      >
        {leading}
        <View style={{ flex: 1 }}>
          {title}
          <Text variant="meta" className="mt-[2px]">
            {sub}
          </Text>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

/**
 * Nothing added yet: hero + the two shortcuts that start a session fast —
 * saved routines (templates you named) and recent sessions to repeat.
 */
export function WorkoutEmptyState({
  routines,
  recent,
  onAddExercises,
  onStartRoutine,
  onRenameRoutine,
  onDeleteRoutine,
  onRepeat
}: WorkoutEmptyStateProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const commitRename = () => {
    const id = renaming;
    setRenaming(null);
    const next = draft.trim();
    if (!id || !next) return;
    const current = routines.find((r) => r.id === id);
    if (current && current.name === next) return;
    onRenameRoutine(id, next);
  };

  return (
    <View>
      <EmptyState
        icon={<Dumbbell size={icon.size.md} color={tokens.text.secondary} strokeWidth={icon.stroke.thin} />}
        title="Build today's workout"
        body="Add exercises, then check off sets as you go. Lifts log in reps × lb, cardio in minutes."
        paddingTop={space[8]}
        center
      >
        <Button icon={<Plus size={icon.size.xs} color={colors.black} />} onPress={onAddExercises}>
          Add exercises
        </Button>
      </EmptyState>

      {routines.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <SectionLabel style={{ marginBottom: space[2] }}>My routines</SectionLabel>
          {routines.map((routine) => (
            <RoutineRow
              key={routine.id}
              accessibilityLabel={`Start ${routine.name}`}
              onPress={() => onStartRoutine(routine.id)}
              leading={<Bookmark size={icon.size.xs} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />}
              title={
                renaming === routine.id ? (
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    selectTextOnFocus
                    maxLength={60}
                    returnKeyType="done"
                    onSubmitEditing={commitRename}
                    onBlur={commitRename}
                    accessibilityLabel="Routine name"
                    style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: tokens.text.primary, padding: 0 }}
                  />
                ) : (
                  <Text variant="username" numberOfLines={1}>
                    {routine.name}
                  </Text>
                )
              }
              sub={routine.exercises.length === 1 ? "1 exercise" : `${routine.exercises.length} exercises`}
              trailing={
                <>
                  <Pressable
                    accessibilityLabel={`Rename ${routine.name}`}
                    hitSlop={10}
                    haptic="none"
                    onPress={() => {
                      setDraft(routine.name);
                      setRenaming(routine.id);
                    }}
                    style={{ padding: space[1] }}
                  >
                    <Pencil size={15} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${routine.name}`}
                    hitSlop={10}
                    haptic="warning"
                    onPress={() =>
                      appAlert(`Delete "${routine.name}"?`, "Your logged workouts aren't affected.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => onDeleteRoutine(routine.id) }
                      ])
                    }
                    style={{ padding: space[1] }}
                  >
                    <Trash2 size={icon.size.xs} color={tokens.status.danger} strokeWidth={icon.stroke.regular} />
                  </Pressable>
                </>
              }
            />
          ))}
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View style={{ marginTop: space[6] }}>
          <SectionLabel style={{ marginBottom: space[2] }}>Do it again</SectionLabel>
          {recent.map((routine) => (
            <RoutineRow
              key={routine.id}
              accessibilityLabel={`Repeat ${routine.name}`}
              onPress={() => onRepeat(routine.id)}
              leading={<Repeat size={icon.size.xs} color={tokens.text.secondary} strokeWidth={icon.stroke.bold} />}
              title={
                <Text variant="username" numberOfLines={1}>
                  {routine.name}
                </Text>
              }
              sub={routine.detail}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
