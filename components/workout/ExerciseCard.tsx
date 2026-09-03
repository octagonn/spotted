import { Check, Plus, Trash2, X } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { ExerciseIcon, exerciseKind } from "@/components/workout/ExerciseIcon";
import { PrBadge } from "@/components/workout/PrBadge";
import type { CardioSet, LiftSet, WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { colors } from "@/theme/colors";
import { durations, springs } from "@/theme/motion";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type EditField = "w" | "r" | "min" | "mi" | "inc";

const CAPS: Record<EditField, { max: number; int: boolean }> = {
  w: { max: 999, int: false },
  r: { max: 200, int: true },
  min: { max: 600, int: true },
  mi: { max: 999, int: false },
  inc: { max: 45, int: false }
};

/** Width of the trailing ✓ / ✕ cluster — column labels reserve the same space. */
const TRAIL_W = 80;
const INDEX_W = 24;

/**
 * Inline set-value input. Keeps a local draft so the field can be cleared
 * mid-typing; commits the sanitized number on every parseable change and
 * falls back to the last committed value on blur. Mono numerals, 44pt tall.
 */
function SetInput({
  field,
  value,
  dimmed,
  label,
  onCommit
}: {
  field: EditField;
  value: number;
  dimmed: boolean;
  label: string;
  onCommit: (value: number) => void;
}) {
  const cfg = CAPS[field];
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Track external changes (e.g. cloned rows) while not typing.
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const change = (raw: string) => {
    let clean = raw.replace(cfg.int ? /[^0-9]/g : /[^0-9.]/g, "");
    const dot = clean.indexOf(".");
    if (dot !== -1) clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, "");
    if (clean.length > 5) clean = clean.slice(0, 5);
    setDraft(clean);
    const n = parseFloat(clean);
    if (!isNaN(n)) onCommit(Math.min(cfg.max, Math.round(n * 10) / 10));
  };

  return (
    <TextInput
      value={draft}
      onChangeText={change}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const n = parseFloat(draft);
        if (isNaN(n)) setDraft(String(value));
      }}
      selectTextOnFocus
      inputMode={cfg.int ? "numeric" : "decimal"}
      keyboardType={cfg.int ? "number-pad" : "decimal-pad"}
      returnKeyType="done"
      accessibilityLabel={label}
      style={{
        flex: 1,
        // Web: <input> has an intrinsic min width that overflows the row
        // without this; native ignores it.
        minWidth: 0,
        marginHorizontal: space[1],
        height: 44,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: focused ? tokens.border.strong : tokens.border.default,
        backgroundColor: focused ? colors.glassSoft : "transparent",
        textAlign: "center",
        fontFamily: "GeistMono_500Medium",
        fontSize: 16,
        color: dimmed ? tokens.text.tertiary : tokens.text.primary,
        padding: 0
      }}
    />
  );
}

/** The ✓ log toggle — pops when checked. 36pt visual, 44pt with hitSlop. */
function CheckButton({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (done) {
      scale.value = withSequence(
        withTiming(0.7, { duration: 0 }),
        withSpring(1.18, springs.bouncy),
        withSpring(1, springs.snappy)
      );
    }
  }, [done, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} haptic="none">
      <Animated.View
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: done ? tokens.text.primary : "transparent",
            borderWidth: done ? 1 : 1.5,
            borderColor: done ? tokens.text.primary : tokens.border.strong
          },
          style
        ]}
      >
        <Check size={18} strokeWidth={3} color={done ? colors.black : tokens.text.tertiary} />
      </Animated.View>
    </Pressable>
  );
}

function ColumnLabel({ children }: { children: string }) {
  return (
    <View style={{ flex: 1, marginHorizontal: space[1] }}>
      <Text variant="micro" className="text-center">
        {children}
      </Text>
    </View>
  );
}

/**
 * Exercise editor card: icon tile + name + set count header, column labels,
 * inline set rows (index · inputs · ✓ log · ✕ remove), and an add-set footer
 * with the exercise delete on the right. Logged rows recede (dimmed numbers).
 */
function ExerciseCardInner({
  exercise,
  onSetValue,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onRemoveExercise
}: {
  exercise: WorkoutExercise;
  onSetValue: (setId: number, field: EditField, value: number) => void;
  onToggleDone: (setId: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: number) => void;
  onRemoveExercise: () => void;
}) {
  const cardio = exercise.kind === "cardio";
  const sports = exercise.muscle === "Sports";
  const inc = cardio && exercise.hasInc;
  const unit = sports ? "Session" : cardio ? "Interval" : "Set";
  const unitLower = unit.toLowerCase();
  const setsLabel = `${exercise.sets.length} ${exercise.sets.length === 1 ? unit : `${unit}s`}`;
  const anyPR = exercise.sets.some((s) => s.pr);

  return (
    <Animated.View
      entering={FadeIn.duration(durations.toast)}
      style={{
        backgroundColor: tokens.bg.raised,
        borderRadius: radius.md,
        // Row spacing is owned by the draggable list wrapper.
        overflow: "hidden"
      }}
    >
      {/* header: icon tile + name + set count */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[3],
          paddingVertical: space[3]
        }}
      >
        <ExerciseIcon kind={exerciseKind(exercise.kind, exercise.muscle)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="username" numberOfLines={1} className="flex-shrink">
              {exercise.name}
            </Text>
            {anyPR ? <PrBadge /> : null}
          </View>
          <Text variant="meta" className="mt-[2px]">
            {setsLabel} · {exercise.muscle}
          </Text>
        </View>
      </View>

      {/* column labels */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space[4],
          paddingTop: space[2],
          paddingBottom: space[1]
        }}
      >
        <View style={{ width: INDEX_W }} />
        {cardio ? (
          <>
            <ColumnLabel>Time (min)</ColumnLabel>
            <ColumnLabel>Miles</ColumnLabel>
            {inc ? <ColumnLabel>Incline %</ColumnLabel> : null}
          </>
        ) : (
          <>
            <ColumnLabel>Reps</ColumnLabel>
            <ColumnLabel>Weight (lb)</ColumnLabel>
          </>
        )}
        <View style={{ width: TRAIL_W }} />
      </View>

      {/* set rows */}
      {exercise.sets.map((s, i) => (
        <View
          key={s.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: space[4],
            paddingVertical: space[1]
          }}
        >
          <View style={{ width: INDEX_W }}>
            <Text variant="numeral-sm" className={s.done ? "text-fog" : "text-silver"}>
              {String(i + 1)}
            </Text>
          </View>
          {cardio ? (
            <>
              <SetInput
                field="min"
                value={(s as CardioSet).min}
                dimmed={s.done}
                label={`Interval ${i + 1} minutes`}
                onCommit={(v) => onSetValue(s.id, "min", v)}
              />
              <SetInput
                field="mi"
                value={(s as CardioSet).mi}
                dimmed={s.done}
                label={`Interval ${i + 1} miles`}
                onCommit={(v) => onSetValue(s.id, "mi", v)}
              />
              {inc ? (
                <SetInput
                  field="inc"
                  value={(s as CardioSet).inc ?? 0}
                  dimmed={s.done}
                  label={`Interval ${i + 1} incline percent`}
                  onCommit={(v) => onSetValue(s.id, "inc", v)}
                />
              ) : null}
            </>
          ) : (
            <>
              <SetInput
                field="r"
                value={(s as LiftSet).r}
                dimmed={s.done}
                label={`Set ${i + 1} reps`}
                onCommit={(v) => onSetValue(s.id, "r", v)}
              />
              <SetInput
                field="w"
                value={(s as LiftSet).w}
                dimmed={s.done}
                label={`Set ${i + 1} weight in pounds`}
                onCommit={(v) => onSetValue(s.id, "w", v)}
              />
            </>
          )}
          <View
            style={{
              width: TRAIL_W,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: space[2]
            }}
          >
            <CheckButton
              done={s.done}
              label={s.done ? `Unlog ${unitLower} ${i + 1}` : `Log ${unitLower} ${i + 1}`}
              onPress={() => onToggleDone(s.id)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${unitLower} ${i + 1}`}
              onPress={() => onRemoveSet(s.id)}
              hitSlop={10}
              haptic="none"
              style={{ width: 28, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <X size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
            </Pressable>
          </View>
        </View>
      ))}

      {/* footer: add set + delete exercise */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: space[4],
          paddingVertical: space[2]
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${unitLower}`}
          onPress={onAddSet}
          hitSlop={8}
          haptic="none"
          style={{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 36 }}
        >
          <Text variant="micro" className="text-white">
            Add {unitLower}
          </Text>
          <Plus size={15} color={tokens.text.primary} strokeWidth={icon.stroke.bold} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={onRemoveExercise}
          hitSlop={8}
          haptic="none"
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** Memoized: the route re-renders on every set edit; only the edited card should. */
export const ExerciseCard = memo(ExerciseCardInner);
