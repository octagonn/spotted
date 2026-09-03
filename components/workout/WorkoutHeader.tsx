import { Pencil, Plus, Timer, TimerOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components/ui/BackButton";
import { IconButton } from "@/components/ui/IconButton";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { fmtClock } from "@/lib/workoutLibrary";
import { durations, easing } from "@/theme/motion";
import { icon, space, tokens } from "@/theme/tokens";

/** The blinking LIVE dot. */
function BlinkDot({ size = 8 }: { size?: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.25, { duration: durations.pulse, easing: easing.standard }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.text.primary }, style]}
    />
  );
}

/** 1 Hz clock, scoped here so the ticking never re-renders the exercise list. */
function LiveClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <Text variant="meta" className="font-monoMedium text-silver">
      · {fmtClock(elapsed)}
    </Text>
  );
}

type WorkoutHeaderProps = {
  name: string;
  onChangeName: (name: string) => void;
  active: boolean;
  startedAt: number;
  restTimerEnabled: boolean;
  onToggleRestTimer: () => void;
  onAddExercises: () => void;
};

/** Logger header: back · editable name + live status · rest-timer toggle · add. */
export function WorkoutHeader({
  name,
  onChangeName,
  active,
  startedAt,
  restTimerEnabled,
  onToggleRestTimer,
  onAddExercises
}: WorkoutHeaderProps) {
  const insets = useSafeAreaInsets();
  const [naming, setNaming] = useState(false);
  return (
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
          {naming ? (
            <TextInput
              autoFocus
              value={name}
              onChangeText={onChangeName}
              maxLength={60}
              placeholder="Name this workout"
              placeholderTextColor={tokens.text.tertiary}
              onSubmitEditing={() => setNaming(false)}
              onBlur={() => setNaming(false)}
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
              onPress={() => setNaming(true)}
              haptic="none"
              accessibilityLabel="Name this workout"
              style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
            >
              <Text variant="heading" numberOfLines={1} className="flex-shrink">
                {name.trim() || "Workout"}
              </Text>
              <Pencil size={13} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
            </Pressable>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2, marginTop: 3 }}>
            {active ? (
              <>
                <BlinkDot />
                <Text variant="meta-strong" className="text-white">
                  Live
                </Text>
                <LiveClock startedAt={startedAt} />
              </>
            ) : (
              <Text variant="meta">Ready — log a set to start the clock</Text>
            )}
          </View>
        </View>
        <IconButton
          variant="plain"
          size={36}
          icon={
            restTimerEnabled ? (
              <Timer size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
            ) : (
              <TimerOff size={icon.size.sm} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
            )
          }
          accessibilityLabel={restTimerEnabled ? "Turn off the rest timer" : "Turn on the rest timer"}
          haptic="selection"
          onPress={onToggleRestTimer}
        />
        <IconButton
          variant="ghost"
          size={36}
          icon={<Plus size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.bold} />}
          accessibilityLabel="Add exercises"
          onPress={onAddExercises}
        />
      </View>
    </View>
  );
}
