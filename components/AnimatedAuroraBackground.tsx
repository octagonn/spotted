import { useEffect } from "react";
import { Dimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

type RingConfig = {
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  borderWidth: number;
};

const rings: RingConfig[] = [
  { size: width * 0.55, delay: 0, duration: 4200, opacity: 0.18, borderWidth: 1.5 },
  { size: width * 0.85, delay: 800, duration: 5200, opacity: 0.13, borderWidth: 1.2 },
  { size: width * 1.15, delay: 1600, duration: 6200, opacity: 0.08, borderWidth: 1 }
];

function Ring({ config }: { config: RingConfig }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true
      )
    );
  }, [config, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + progress.value * 0.18 }],
    opacity: config.opacity * (0.55 + progress.value * 0.6)
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          borderWidth: config.borderWidth,
          borderColor: "#FFFFFF"
        },
        animatedStyle
      ]}
    />
  );
}

function GlowOrb({ delay, x, y, size, hue }: { delay: number; x: number; y: number; size: number; hue: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 7000 + delay, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + (progress.value - 0.5) * 60 },
      { translateY: y + (progress.value - 0.5) * 80 },
      { scale: 0.85 + progress.value * 0.4 }
    ],
    opacity: 0.15 + progress.value * 0.18
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `rgba(${hue},${hue},${hue},1)`
        },
        style
      ]}
    />
  );
}

function GridLines() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.linear }),
      -1,
      false
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -100 + progress.value * 100 }],
    opacity: 0.05
  }));

  const rows = [];
  const STEP = 100;
  for (let y = 0; y < height + 200; y += STEP) {
    rows.push(
      <View
        key={`h-${y}`}
        style={{
          position: "absolute",
          top: y,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "#FFFFFF"
        }}
      />
    );
  }
  for (let x = 0; x < width + 100; x += STEP) {
    rows.push(
      <View
        key={`v-${x}`}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: x,
          width: 1,
          backgroundColor: "#FFFFFF"
        }}
      />
    );
  }

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }, style]}>
      {rows}
    </Animated.View>
  );
}

export function AnimatedAuroraBackground() {
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
    >
      <GridLines />
      <GlowOrb delay={0} x={centerX - width * 0.55} y={centerY - height * 0.4} size={width * 0.65} hue={245} />
      <GlowOrb delay={1500} x={centerX + width * 0.05} y={centerY + height * 0.05} size={width * 0.55} hue={200} />
      {rings.map((ring) => (
        <Ring key={`${ring.size}-${ring.delay}`} config={ring} />
      ))}
    </View>
  );
}
