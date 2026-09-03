import { ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { fmtClock } from "@/lib/workoutLibrary";
import { useWorkoutSession } from "@/stores/workoutSession";
import { durations, easing } from "@/theme/motion";
import { icon, radius, space, tokens } from "@/theme/tokens";

function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.25, { duration: durations.pulse, easing: easing.standard }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />
  );
}

function Clock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Text variant="numeral-sm" className="text-gold">
      {fmtClock(startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0)}
    </Text>
  );
}

/**
 * The live session card on My Workouts: an important active state, so the
 * gold is on the status line only — the card itself stays neutral.
 */
export function InProgressCard({ onResume }: { onResume: () => void }) {
  const startedAt = useWorkoutSession((s) => s.startedAt);
  const exercises = useWorkoutSession((s) => s.exercises);

  let vol = 0;
  let sets = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      sets += 1;
      if (ex.kind === "lift") vol += (s as { w: number; r: number }).w * (s as { w: number; r: number }).r;
    }
  }
  const exCount = exercises.length;
  const hasLift = exercises.some((e) => e.kind === "lift");
  const hasCardio = exercises.some((e) => e.kind === "cardio");
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
    <Pressable
      onPress={onResume}
      haptic="none"
      accessibilityLabel={`${title} in progress. Resume`}
      style={{ marginHorizontal: space[4], marginBottom: space[2] }}
    >
      <View
        style={{
          borderRadius: radius.md,
          backgroundColor: tokens.bg.raised,
          borderWidth: 1,
          borderColor: tokens.accent.goldSubtle,
          padding: space[4]
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <PulseDot color={tokens.accent.gold} />
            <Text variant="micro" className="text-gold">
              In progress ·
            </Text>
            <Clock startedAt={startedAt} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
            <Text variant="meta-strong" className="text-gold">
              Resume
            </Text>
            <ChevronRight size={icon.size.xs} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />
          </View>
        </View>
        <Text variant="subheading" className="mt-3">
          {title}
        </Text>
        <Text variant="meta" className="mt-[2px]">
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}
