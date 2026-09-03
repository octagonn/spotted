import { Image } from "expo-image";
import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { gymLogo, gymLogoIsFullBleed, type GymBrandRef } from "@/lib/gymChains";
import { colors } from "@/theme/colors";

/**
 * Chain logo tile for a gym (one bundled logo per chain — see lib/gymChains).
 * Logos sit on a white disc so dark wordmarks stay legible on the dark UI.
 * Independents (no chain art) render `fallback` in the same frame.
 */
export function GymLogo({
  gym,
  size,
  radius,
  fallback,
  style
}: {
  gym: GymBrandRef;
  size: number;
  /** Corner radius; defaults to a circle. */
  radius?: number;
  fallback: ReactNode;
  style?: ViewStyle;
}) {
  const source = gymLogo(gym);
  const r = radius ?? size / 2;
  if (!source) return <>{fallback}</>;
  if (gymLogoIsFullBleed(gym)) {
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: r, overflow: "hidden", borderWidth: 1, borderColor: colors.iron },
          style
        ]}
      >
        <Image source={source} contentFit="cover" style={{ width: size, height: size }} accessible={false} />
      </View>
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          overflow: "hidden",
          backgroundColor: colors.pure,
          borderWidth: 1,
          borderColor: colors.iron,
          alignItems: "center",
          justifyContent: "center"
        },
        style
      ]}
    >
      {/* 68% keeps wide wordmarks fully inside a circular tile (never clipped by the corners). */}
      <Image
        source={source}
        contentFit="contain"
        style={{ width: size * 0.68, height: size * 0.68 }}
        accessible={false}
      />
    </View>
  );
}
