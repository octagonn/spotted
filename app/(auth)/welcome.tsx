import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedAuroraBackground } from "@/components/AnimatedAuroraBackground";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

const ICON_SIZE = 168;

function BreathingIcon() {
  const breath = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    breath.value = withDelay(
      400,
      withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.cubic) }), -1, true)
    );
  }, [breath, reveal]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + reveal.value * 0.15 + breath.value * 0.04 }],
    opacity: reveal.value
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + breath.value * 0.5,
    transform: [{ scale: 1.0 + breath.value * 0.15 }]
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: 0.2 + breath.value * 0.35,
    transform: [{ scale: 1.0 + breath.value * 0.28 }]
  }));

  return (
    <Animated.View style={[{ alignItems: "center", justifyContent: "center" }, containerStyle]}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: ICON_SIZE * 1.4,
            height: ICON_SIZE * 1.4,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#FFFFFF"
          },
          ring2Style
        ]}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            width: ICON_SIZE * 1.2,
            height: ICON_SIZE * 1.2,
            borderRadius: 999,
            borderWidth: 1.2,
            borderColor: "#FFFFFF"
          },
          ringStyle
        ]}
      />
      <View
        // Decorative app icon — hide from screen readers (the "SPOTTED" wordmark
        // below carries the name).
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: 36,
          overflow: "hidden",
          borderWidth: 2,
          borderColor: "#FFFFFF",
          backgroundColor: "#000000"
        }}
      >
        <Image
          source={require("@/assets/images/icon.png")}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    </Animated.View>
  );
}

function SpottedReveal() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      400,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 20 - progress.value * 20 }]
  }));

  return (
    <Animated.Text
      maxFontSizeMultiplier={1.4}
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[
        {
          fontFamily: "Boldonse_400Regular",
          fontSize: 60,
          lineHeight: 96,
          letterSpacing: -1.2,
          color: "#FAFAFA",
          textTransform: "uppercase",
          paddingTop: 22,
          paddingBottom: 4
        },
        style
      ]}
    >
      SPOTTED
    </Animated.Text>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-black">
      <AnimatedAuroraBackground />
      <GrainOverlay opacity={0.07} />

      <View
        className="flex-1 px-6"
        style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 }}
      >
        <View className="flex-1 items-center justify-center">
          <Animated.View entering={FadeInDown.duration(700)}>
            <BreathingIcon />
          </Animated.View>
        </View>

        <View className="gap-4">
          <Animated.View entering={FadeInDown.duration(600).delay(150)}>
            <View className="self-start overflow-hidden rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
              <Text variant="micro" className="text-mist">
                DAILY · GYM · STORIES
              </Text>
            </View>
          </Animated.View>

          <SpottedReveal />

          <Animated.View entering={FadeInDown.duration(600).delay(900)}>
            <Text variant="italic" className="max-w-[320px]">
              Daily posts from your gym crew.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(1100)} className="mt-2 gap-3">
            <Button onPress={() => router.push("/sign-in")}>Start</Button>
            <Text variant="micro" className="text-fog">
              ALREADY ON IT? TAP START — IT'LL FIND YOUR ACCOUNT.
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
