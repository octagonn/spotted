import { Image } from "expo-image";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { colors } from "@/theme/colors";

/**
 * Startup splash — the Instagram pattern.
 *
 * The app used to show a bare spinner on black while auth hydrated, which read
 * as "something is broken" rather than "we're opening". Instagram never shows a
 * spinner here: it shows the mark, centred, and the wordmark at the very
 * bottom, so the launch feels like one continuous branded moment.
 *
 * The mark is the SAME asset at the SAME 180px width as the native splash
 * (see the expo-splash-screen config in app.config.ts), on the same black —
 * so when the native splash hands off to JS there is no visible jump at all.
 * The only motion is a slow breathe, which keeps the screen feeling alive
 * without implying a progress bar that isn't real.
 */
export function AppSplash() {
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [breathe]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: 0.82 + breathe.value * 0.18,
    transform: [{ scale: 0.985 + breathe.value * 0.015 }]
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={markStyle}>
        <Image
          source={require("../../assets/images/splash-icon.png")}
          accessible
          accessibilityLabel="Spotted"
          contentFit="contain"
          // Matches expo-splash-screen's imageWidth so the handoff is seamless.
          style={{ width: 180, height: 180 }}
        />
      </Animated.View>

      <View style={{ position: "absolute", bottom: 56, alignItems: "center" }}>
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            fontFamily: "Boldonse_400Regular",
            fontSize: 13,
            letterSpacing: 1.5,
            color: colors.fog,
            includeFontPadding: false
          }}
        >
          SPOTTED
        </Text>
      </View>
    </View>
  );
}
