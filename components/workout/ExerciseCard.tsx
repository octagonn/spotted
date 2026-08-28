import { Activity, Check, Dumbbell, Flame, Plus, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import type { CardioSet, LiftSet, WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { radius, tokens } from "@/theme/tokens";
import { MED, NUM, SEMI, W } from "@/components/workout/wtheme";

export type EditField = "w" | "r" | "min" | "mi" | "inc";

function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        { fontFamily: MED, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: W.faint },
        style
      ]}
    >
      {children}
    </Text>
  );
}

const CAPS: Record<EditField, { max: number; int: boolean }> = {
  w: { max: 999, int: false },
  r: { max: 200, int: true },
  min: { max: 600, int: true },
  mi: { max: 999, int: false },
  inc: { max: 45, int: false }
};

/**
 * Inline set-value input (WHOOP-style bordered cell). Keeps a local draft so
 * the field can be cleared mid-typing; commits the sanitized number on every
 * parseable change and falls back to the last committed value on blur.
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
      accessibilityLabel={label}
      style={{
        flex: 1,
        // Web: <input> has an intrinsic min width that overflows the row
        // without this; native ignores it.
        minWidth: 0,
        marginHorizontal: 4,
        paddingVertical: 9,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: focused ? W.strong : W.line,
        backgroundColor: "rgba(255,255,255,0.03)",
        textAlign: "center",
        fontFamily: NUM,
        fontSize: 15,
        color: dimmed ? W.muted : W.text,
        padding: 0
      }}
    />
  );
}

/** The ✓ log toggle — pops when checked. */
function CheckButton({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (done) {
      scale.value = withSequence(
        withTiming(0.7, { duration: 0 }),
        withSpring(1.18, { damping: 12, stiffness: 380 }),
        withSpring(1, { damping: 16, stiffness: 300 })
      );
    }
  }, [done, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}>
      <Animated.View
        style={[
          {
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: done ? W.text : "transparent",
            borderWidth: done ? 1 : 1.5,
            borderColor: done ? W.text : W.strong
          },
          style
        ]}
      >
        <Check size={16} strokeWidth={3} color={done ? W.ink : W.faint} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * WHOOP-style exercise editor card: icon tile + name + set count header,
 * column labels, inline set rows (index · editable inputs · ✓ log · ✕
 * remove), and an ADD SET footer with the exercise delete on the right.
 */
export function ExerciseCard({
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
  const Icon = sports ? Activity : cardio ? Flame : Dumbbell;
  const unit = sports ? "Session" : cardio ? "Interval" : "Set";
  const setsLabel = `${exercise.sets.length} ${exercise.sets.length === 1 ? unit : `${unit}s`}`;
  const anyPR = exercise.sets.some((s) => s.pr);

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        backgroundColor: W.card,
        borderWidth: 1,
        borderColor: W.line,
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
          gap: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: "rgba(255,255,255,0.03)"
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: radius.sm,
            backgroundColor: W.card2,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Icon size={20} color={W.text} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text numberOfLines={1} style={{ fontFamily: SEMI, fontSize: 15.5, color: W.text, flexShrink: 1 }}>
              {exercise.name}
            </Text>
            {anyPR ? (
              <View style={{ backgroundColor: tokens.accent.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontFamily: NUM, fontSize: 9, letterSpacing: 1, color: W.ink }}>PR</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ marginTop: 2, fontFamily: "Geist_400Regular", fontSize: 12.5, color: W.muted }}>
            {setsLabel} · {exercise.muscle}
          </Text>
        </View>
      </View>

      {/* column labels */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View style={{ width: 24 }} />
        {cardio ? (
          <>
            <View style={{ flex: 1, marginHorizontal: 4 }}>
              <Micro style={{ textAlign: "center" }}>Time (min)</Micro>
            </View>
            <View style={{ flex: 1, marginHorizontal: 4 }}>
              <Micro style={{ textAlign: "center" }}>Miles</Micro>
            </View>
            {inc ? (
              <View style={{ flex: 1, marginHorizontal: 4 }}>
                <Micro style={{ textAlign: "center" }}>Incline %</Micro>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={{ flex: 1, marginHorizontal: 4 }}>
              <Micro style={{ textAlign: "center" }}>Reps</Micro>
            </View>
            <View style={{ flex: 1, marginHorizontal: 4 }}>
              <Micro style={{ textAlign: "center" }}>Weight (lbs)</Micro>
            </View>
          </>
        )}
        <View style={{ width: 66 }} />
      </View>

      {/* set rows */}
      {exercise.sets.map((s, i) => (
        <View
          key={s.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 5
          }}
        >
          <View style={{ width: 24 }}>
            <Text style={{ fontFamily: SEMI, fontSize: 14, color: W.muted }}>{i + 1}</Text>
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
          <View style={{ width: 66, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <CheckButton
              done={s.done}
              label={s.done ? `Unlog ${cardio ? "interval" : "set"} ${i + 1}` : `Log ${cardio ? "interval" : "set"} ${i + 1}`}
              onPress={() => onToggleDone(s.id)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${cardio ? "interval" : "set"} ${i + 1}`}
              onPress={() => onRemoveSet(s.id)}
              hitSlop={8}
            >
              <X size={16} color={W.faint} strokeWidth={2.2} />
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
          paddingHorizontal: 16,
          paddingVertical: 12
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${unit.toLowerCase()}`}
          onPress={onAddSet}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Micro style={{ color: W.text, fontSize: 12 }}>Add {unit.toLowerCase()}</Micro>
          <Plus size={15} color={W.text} strokeWidth={2.4} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={onRemoveExercise}
          hitSlop={8}
          style={{ padding: 2 }}
        >
          <Trash2 size={16} color={W.faint} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
