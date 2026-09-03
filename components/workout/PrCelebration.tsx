import { Trophy } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import { Confetti } from "@/components/workout/Confetti";
import { colors } from "@/theme/colors";
import { durations, springs } from "@/theme/motion";
import { radius, space, tokens } from "@/theme/tokens";

/** Full-screen PR flash: gold badge pop + confetti. Gold is earned here. */
export function PrCelebration({ text, confKey }: { text: string; confKey: number }) {
  const scale = useSharedValue(0.4);
  const flash = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, springs.bouncy);
    flash.value = withSequence(
      withTiming(0.5, { duration: durations.flashIn }),
      withTiming(0, { duration: durations.celebration })
    );
  }, [scale, flash]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 70 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.accent.gold }, flashStyle]} />
      <Animated.View
        style={[{ position: "absolute", top: "32%", left: 0, right: 0, alignItems: "center" }, badgeStyle]}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.pill,
            backgroundColor: tokens.accent.gold,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Trophy size={48} color={colors.black} strokeWidth={1.8} />
        </View>
        <View style={{ marginTop: space[4], alignItems: "center" }}>
          <Text variant="display-sm">New PR!</Text>
          <Text variant="subheading" className="text-gold mt-[6px]">
            {text}
          </Text>
        </View>
      </Animated.View>
      <Confetti seed={confKey} />
    </View>
  );
}
