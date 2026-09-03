import { ChevronRight } from "lucide-react-native";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { ExerciseIcon } from "@/components/workout/ExerciseIcon";
import { PrBadge } from "@/components/workout/PrBadge";
import type { WorkoutRow } from "@/hooks/queries/useWorkouts";
import { relDay } from "@/lib/relDay";
import { icon, radius, space, tokens } from "@/theme/tokens";

type WorkoutHistoryCardProps = {
  workout: WorkoutRow;
  onPress: () => void;
  /** Long-press / accessibility actions (owner only). */
  onEdit?: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
};

/** One row of workout history: icon · name + when · sets · chevron. */
export function WorkoutHistoryCard({ workout, onPress, onEdit, onDelete, onLongPress }: WorkoutHistoryCardProps) {
  const cardioOnly = workout.totalVolume === 0 && workout.cardioMinutes > 0;
  const timeLabel = new Date(workout.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const prCount = workout.prs.length;
  const exWord = workout.exerciseCount === 1 ? "exercise" : "exercises";
  const countValue = workout.totalSets > 0 ? workout.totalSets : workout.exerciseCount;
  const countLabel = workout.totalSets > 0 ? (workout.totalSets === 1 ? "set" : "sets") : "activities";
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      haptic="none"
      accessibilityLabel={`${workout.name}, ${relDay(workout.startedAt)}`}
      accessibilityActions={
        onEdit || onDelete
          ? [
              ...(onEdit ? [{ name: "edit", label: "Edit workout" }] : []),
              ...(onDelete ? [{ name: "delete", label: "Delete from history" }] : [])
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "edit") onEdit?.();
        else if (event.nativeEvent.actionName === "delete") onDelete?.();
      }}
      style={{ marginHorizontal: space[4], marginBottom: space[2] }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          backgroundColor: tokens.bg.raised,
          borderRadius: radius.md,
          padding: space[3]
        }}
      >
        <ExerciseIcon kind={cardioOnly ? "cardio" : "lift"} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="username" numberOfLines={1} className="flex-shrink">
              {workout.name}
            </Text>
            {prCount > 0 ? <PrBadge count={prCount} /> : null}
          </View>
          <Text variant="meta" className="mt-[2px]" numberOfLines={1}>
            {`${relDay(workout.startedAt)} · ${timeLabel} · ${workout.exerciseCount} ${exWord}`}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text variant="numeral-sm">{String(countValue)}</Text>
          <Text variant="micro">{countLabel}</Text>
        </View>
        <ChevronRight size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
      </View>
    </Pressable>
  );
}
