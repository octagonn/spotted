import { LinearGradient } from "expo-linear-gradient";
import { Check, Pencil, Trophy } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { SessionPR } from "@/hooks/queries/useWorkouts";
import { fmtClock } from "@/lib/workoutLibrary";
import { colors } from "@/theme/colors";
import { durations, springs } from "@/theme/motion";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type WorkoutSummary = {
  title: string;
  volume: number;
  sets: number;
  reps: number;
  cardioMin: number;
  duration: number;
  exCount: number;
  prs: SessionPR[];
  celebrations: TrophyShareData[];
};

/** Summary check circle with a pop-in. */
function CheckPop() {
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withSequence(withSpring(1.15, springs.bouncy), withSpring(1, springs.snappy));
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        {
          width: 64,
          height: 64,
          borderRadius: radius.pill,
          backgroundColor: tokens.text.primary,
          alignItems: "center",
          justifyContent: "center"
        },
        style
      ]}
    >
      <Check size={28} strokeWidth={3} color={colors.black} />
    </Animated.View>
  );
}

/** Cubic ease-out count-up to `target`, scoped so the ticks stay in this leaf. */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / durations.celebration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p >= 1) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [target]);
  return value;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text variant="numeral-lg">{String(value)}</Text>
      <Text variant="micro" className="mt-[3px]">
        {label}
      </Text>
    </View>
  );
}

type WorkoutFinishSummaryProps = {
  summary: WorkoutSummary;
  onRename: (name: string) => void;
  /** Action buttons rendered at the bottom (the route decides which). */
  children: ReactNode;
};

/** "<Title> logged" — the post-save moment: headline number, stats, PR chips, actions. */
export function WorkoutFinishSummary({ summary, onRename, children }: WorkoutFinishSummaryProps) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.title);
  const headlineIsVolume = summary.volume > 0;
  const headline = useCountUp(headlineIsVolume ? summary.volume : summary.cardioMin);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== summary.title) onRename(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <LinearGradient
        colors={[tokens.bg.raised, colors.black]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300 }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[10],
          paddingBottom: insets.bottom + space[6],
          flexGrow: 1
        }}
      >
        <View style={{ alignItems: "center", paddingHorizontal: space[6] }}>
          <CheckPop />
          {editing ? (
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={commit}
              onBlur={commit}
              maxLength={60}
              accessibilityLabel="Workout name"
              style={{
                marginTop: space[6],
                minWidth: 200,
                textAlign: "center",
                fontFamily: "Geist_700Bold",
                fontSize: 24,
                color: tokens.text.primary,
                borderBottomWidth: 1,
                borderBottomColor: tokens.border.strong,
                paddingVertical: space[1]
              }}
            />
          ) : (
            <Pressable
              onPress={() => {
                setDraft(summary.title);
                setEditing(true);
              }}
              haptic="none"
              accessibilityLabel="Rename workout"
              style={{
                marginTop: space[6],
                flexDirection: "row",
                alignItems: "center",
                gap: space[2],
                paddingHorizontal: space[4]
              }}
            >
              <Text variant="heading" className="text-center flex-shrink">
                {summary.title} logged
              </Text>
              <Pencil size={14} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
            </Pressable>
          )}
          <Text variant="micro" className="mt-2 text-silver">
            {fmtClock(summary.duration)} · {summary.exCount} {summary.exCount === 1 ? "exercise" : "exercises"}
          </Text>

          <View style={{ marginTop: space[8], alignItems: "center" }}>
            <Text variant="numeral-xl">{headline.toLocaleString()}</Text>
            <Text variant="micro" className="mt-1">
              {headlineIsVolume ? "Total volume · lb" : "Cardio · min"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: space[8], marginTop: space[6] }}>
            <Stat value={summary.sets} label="Sets" />
            <Stat value={summary.reps} label="Reps" />
            {headlineIsVolume && summary.cardioMin > 0 ? <Stat value={summary.cardioMin} label="Cardio · min" /> : null}
          </View>

          {summary.prs.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: space[2],
                marginTop: space[6]
              }}
            >
              {summary.prs.map((pr) => (
                <View
                  key={pr.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[2],
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                    borderRadius: radius.pill,
                    backgroundColor: tokens.accent.goldSubtle
                  }}
                >
                  <Trophy size={14} color={tokens.accent.gold} strokeWidth={icon.stroke.regular} />
                  <Text variant="label" className="text-gold">
                    PR · {pr.name} {pr.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: "auto", paddingHorizontal: space[6], paddingTop: space[6], gap: space[2] }}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}
