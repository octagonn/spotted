import { Flame } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors } from "@/theme/colors";

type FlameSize = "xs" | "sm" | "md" | "lg";

const iconSizes = {
  xs: 22,
  sm: 32,
  md: 56,
  lg: 136
} as const;

const boxClasses = {
  xs: "h-7 w-7",
  sm: "h-10 w-10",
  md: "h-18 w-18",
  lg: "h-44 w-44"
} as const;

export function StreakFlame({ size = "md" }: { size?: FlameSize }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.03, { duration: 1200 }), -1, true);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View className={["items-center justify-center border border-hairline-strong bg-black", boxClasses[size]].join(" ")}>
        <View className="absolute inset-1 border border-hairline-strong opacity-40" />
        <Flame color={colors.pure} size={iconSizes[size]} strokeWidth={1.7} />
      </View>
    </Animated.View>
  );
}
