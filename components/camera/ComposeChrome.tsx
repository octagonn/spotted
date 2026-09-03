import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/** 38pt bordered tile for a row's leading glyph (compose option rows, sheet rows). */
export function IconTile({ children, round = false }: { children: ReactNode; round?: boolean }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: round ? radius.pill : radius.sm - 2,
        borderWidth: 1,
        borderColor: tokens.border.strong,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </View>
  );
}

/** Step indicator over the camera: "● REVIEW". Sits on media, so it uses the scrim. */
export function StepPill({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2] - 1,
        backgroundColor: tokens.bg.scrim,
        borderWidth: 1,
        borderColor: colors.white,
        borderRadius: radius.pill,
        paddingVertical: space[2],
        paddingHorizontal: space[4]
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />
      <Text variant="micro" className="font-sansBold text-white tracking-[1.2px]">
        {children}
      </Text>
    </View>
  );
}

/** Dual-camera glyph, Snapchat-style: two overlapping rounded frames offset
 *  diagonally (front card occludes the back one). Gold = active. */
export function DualCameraIcon({ active }: { active: boolean }) {
  const color = active ? tokens.accent.gold : colors.white;
  return (
    <View style={{ width: 20, height: 20 }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 13,
          height: 13,
          borderRadius: 4,
          borderWidth: 1.8,
          borderColor: color,
          opacity: 0.6
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 13,
          height: 13,
          borderRadius: 4,
          borderWidth: 1.8,
          borderColor: color,
          backgroundColor: tokens.bg.scrim
        }}
      />
    </View>
  );
}
