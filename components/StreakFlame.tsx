import { Canvas, Circle, Group, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors } from "@/theme/colors";

type FlameSize = "xs" | "sm" | "md" | "lg";

const sizes = {
  xs: 28,
  sm: 40,
  md: 72,
  lg: 176
} as const;

export function StreakFlame({ size = "md" }: { size?: FlameSize }) {
  const dimension = sizes[size];
  const scale = useSharedValue(1);
  const flamePath = Skia.Path.Make();
  flamePath.moveTo(dimension * 0.5, dimension * 0.08);
  flamePath.cubicTo(dimension * 0.72, dimension * 0.28, dimension * 0.88, dimension * 0.52, dimension * 0.7, dimension * 0.82);
  flamePath.cubicTo(dimension * 0.58, dimension * 0.98, dimension * 0.28, dimension * 0.98, dimension * 0.18, dimension * 0.76);
  flamePath.cubicTo(dimension * 0.06, dimension * 0.48, dimension * 0.28, dimension * 0.28, dimension * 0.5, dimension * 0.08);
  flamePath.close();

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.03, { duration: 1200 }), -1, true);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View className="items-center justify-center">
        <Canvas style={{ width: dimension, height: dimension }}>
          <Group>
            <Path path={flamePath}>
              <RadialGradient
                c={vec(dimension * 0.5, dimension * 0.54)}
                r={dimension * 0.48}
                colors={[colors.pure, colors.mist, colors.fog]}
              />
            </Path>
            <Circle cx={dimension * 0.38} cy={dimension * 0.78} r={dimension * 0.05} color={colors.silver} opacity={0.6} />
            <Circle cx={dimension * 0.6} cy={dimension * 0.68} r={dimension * 0.035} color={colors.mist} opacity={0.5} />
            <Circle cx={dimension * 0.52} cy={dimension * 0.34} r={dimension * 0.025} color={colors.pure} opacity={0.42} />
          </Group>
        </Canvas>
      </View>
    </Animated.View>
  );
}
