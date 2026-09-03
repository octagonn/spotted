import { LinearGradient } from "expo-linear-gradient";
import { Zap } from "lucide-react-native";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { colors } from "@/theme/colors";

/** Feather depth of the misty edge, in px. */
const EDGE = 110;
const TRACK_H = 150;
const MIN_LEVEL = 0.15;

/** Remembered across mounts so the ring comes back at your last brightness. */
let lastLevel = 0.65;

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Snapchat-style front-camera "flash": no hardware flash exists on the selfie
 * cam, so a soft white ring (misty, feathered edges) lights the face using the
 * screen itself. The vertical slider on the right adjusts brightness — the
 * whole overlay opacity tracks the drag live on the UI thread.
 */
export function FrontFlash() {
  const level = useSharedValue(lastLevel);
  const startLevel = useSharedValue(lastLevel);

  const remember = (v: number) => {
    lastLevel = v;
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startLevel.value = level.value;
    })
    .onUpdate((e) => {
      const next = startLevel.value - e.translationY / TRACK_H;
      level.value = Math.min(1, Math.max(MIN_LEVEL, next));
    })
    .onEnd(() => {
      runOnJS(remember)(level.value);
    });

  const ringStyle = useAnimatedStyle(() => ({ opacity: level.value }));
  // Thumb rides the track: level MIN..1 → bottom offset 0..TRACK_H-22.
  const thumbStyle = useAnimatedStyle(() => ({
    bottom: ((level.value - MIN_LEVEL) / (1 - MIN_LEVEL)) * (TRACK_H - 22)
  }));
  const fillStyle = useAnimatedStyle(() => ({
    height: ((level.value - MIN_LEVEL) / (1 - MIN_LEVEL)) * (TRACK_H - 22) + 11
  }));

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* ---- the misty white ring (never blocks touches) ---- */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, ringStyle]}
      >
        {/* faint overall wash so the whole frame lifts */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.10)"
          }}
        />
        <AnimatedGradient
          colors={["rgba(255,255,255,0.96)", "rgba(255,255,255,0)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: EDGE }}
        />
        <AnimatedGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.96)"]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: EDGE }}
        />
        <AnimatedGradient
          colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: EDGE }}
        />
        <AnimatedGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.9)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: EDGE }}
        />
      </Animated.View>

      {/* ---- brightness slider (right edge, Snapchat-style) ---- */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", right: 14, top: "32%", alignItems: "center", gap: 8 }}
      >
        <Zap size={14} color={colors.black} strokeWidth={2.4} fill={colors.black} />
        <GestureDetector gesture={pan}>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="Front flash brightness"
            hitSlop={16}
            style={{
              width: 26,
              height: TRACK_H,
              borderRadius: 13,
              backgroundColor: "rgba(0,0,0,0.30)",
              alignItems: "center",
              justifyContent: "flex-end",
              overflow: "hidden"
            }}
          >
            <Animated.View
              style={[
                { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.45)" },
                fillStyle
              ]}
            />
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.white,
                  shadowColor: "#000",
                  shadowOpacity: 0.35,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 }
                },
                thumbStyle
              ]}
            />
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}
