import type { ReactNode } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/**
 * Shared camera chrome + capture-surface rules.
 *
 * Every camera screen in the app (daily/story/lift capture, chat camera,
 * reaction selfie) builds on these so behavior can't drift between them.
 */

/** 40px translucent circle button — the camera control unit. */
export function CameraKitCircleButton({
  label,
  onPress,
  children
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.5)",
          borderWidth: 1,
          borderColor: colors.slate,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

/**
 * Capture-surface props every CameraView must spread.
 *
 * Two rules, in one place so no screen can get them wrong:
 *
 *  1. `animateShutter: false` — expo-camera's default shutter animation blinks
 *     the whole screen white on capture. On the selfie camera that reads as
 *     "the flash fired" even with flash off, so it is always disabled.
 *  2. Hardware flash is BACK-CAMERA ONLY. iOS front "flash" is a blinding
 *     full-screen white blast; the front camera uses the soft FrontFlash
 *     screen ring instead, and only when the user turns flash on.
 */
export function cameraSurfaceProps({
  flashOn,
  facing,
  videoMode = false,
  recording = false
}: {
  flashOn: boolean;
  facing: "front" | "back";
  /** Session is in video mode (torch stays lit through a recording). */
  videoMode?: boolean;
  recording?: boolean;
}): { flash: "on" | "off"; enableTorch: boolean; animateShutter: false } {
  const backFlash = flashOn && facing === "back";
  return {
    flash: backFlash ? "on" : "off",
    enableTorch: backFlash && videoMode && recording,
    animateShutter: false
  };
}
