import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";

import { Confetti } from "@/components/workout/Confetti";
import { useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

const DURATION_MS = 1900;

/** Escalating haptic salvo — thump, double-tap, success bloom, sparkle taps. */
function playHaptics() {
  const fire = (fn: () => Promise<void>, at: number) => setTimeout(() => void fn().catch(() => {}), at);
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 0);
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 130);
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 260);
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 420);
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 700);
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 850);
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1000);
}

/**
 * Full-screen publish burst: gold flash, confetti rain, a stamped POSTED badge
 * with an expanding ring, and an escalating haptic salvo. Mount once at the
 * root (above everything); trigger via `triggerPostCelebration()` right after
 * a story / daily / lift post goes out. Auto-dismisses in ~1.9s and renders
 * nothing while idle.
 */
export function PostCelebration() {
  const signal = useUiStore((state) => state.celebrationSignal);
  const reduced = useReducedMotion();
  const [activeKey, setActiveKey] = useState(0);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useSharedValue(0);
  const stampScale = useSharedValue(0);
  const stampOpacity = useSharedValue(0);
  const stampRotate = useSharedValue(0);
  const ring = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    playHaptics();
    setActiveKey(signal);
    if (!reduced) {
      // Gold flash → out.
      flash.value = 0;
      flash.value = withSequence(
        withTiming(0.55, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 550, easing: Easing.in(Easing.quad) })
      );
      // Stamp slams in with overshoot + a slight twist, holds, then fades.
      stampScale.value = 0.2;
      stampRotate.value = -14;
      stampOpacity.value = 0;
      stampOpacity.value = withSequence(
        withTiming(1, { duration: 120 }),
        withDelay(1050, withTiming(0, { duration: 320 }))
      );
      stampScale.value = withSpring(1, { damping: 9, stiffness: 260, mass: 0.7 });
      stampRotate.value = withSpring(-4, { damping: 10, stiffness: 200 });
      // Two expanding pulse rings.
      ring.value = 0;
      ring2.value = 0;
      ring.value = withDelay(90, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
      ring2.value = withDelay(280, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActiveKey(0), DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampOpacity.value,
    transform: [{ scale: stampScale.value }, { rotate: `${stampRotate.value}deg` }]
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.8,
    transform: [{ scale: 0.4 + ring.value * 2.1 }]
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: (1 - ring2.value) * 0.5,
    transform: [{ scale: 0.4 + ring2.value * 2.9 }]
  }));

  if (activeKey === 0) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}>
      {/* Gold flash wash */}
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.accent.gold },
          flashStyle
        ]}
      />
      {/* Confetti rain (already reduced-motion aware internally) */}
      <Confetti seed={activeKey} count={64} />
      {/* Center stamp + pulse rings */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        {[ringStyle, ring2Style].map((style, i) => (
          <Animated.View
            key={i}
            style={[
              {
                position: "absolute",
                width: 120,
                height: 120,
                borderRadius: 60,
                borderWidth: 2,
                borderColor: tokens.accent.gold
              },
              style
            ]}
          />
        ))}
        <Animated.View style={[{ alignItems: "center", gap: 12 }, stampStyle]}>
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: tokens.accent.gold,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: tokens.accent.gold,
              shadowOpacity: 0.8,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 0 },
              elevation: 14
            }}
          >
            <Check size={46} color={colors.black} strokeWidth={3} />
          </View>
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.72)",
              borderWidth: 1.5,
              borderColor: tokens.accent.gold
            }}
          >
            <Animated.Text
              style={{
                fontFamily: "Boldonse_400Regular",
                fontSize: 19,
                letterSpacing: 3,
                color: tokens.accent.gold,
                textTransform: "uppercase"
              }}
            >
              Posted
            </Animated.Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
