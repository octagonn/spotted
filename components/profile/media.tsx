import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Media placeholders for the profile surfaces. The mockup's `.ph` scene
 * gradients are placeholders for real camera media (spec §0) — when a real
 * `uri` is provided we render it and apply the legibility gradient
 * `linear-gradient(180deg, rgba(0,0,0,0.12), transparent 30%, transparent 62%, rgba(0,0,0,0.4))`.
 */

/** Dark monochrome scene gradients standing in for photos (mock only). */
const SCENES: readonly [string, string][] = [
  ["#2E2E33", "#111113"],
  ["#3A3A40", "#141416"],
  ["#26262B", "#0C0C0E"],
  ["#44444B", "#18181B"],
  ["#333338", "#101012"],
  ["#3F3F46", "#131315"]
];

function sceneFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return SCENES[Math.abs(hash) % SCENES.length];
}

export type SceneMediaProps = {
  /** Deterministic mock-scene seed (used when no `uri`). */
  seed: string;
  uri?: string | null;
  /** e.g. 3 / 3.6 for post media, 3 / 4 for cards. Omit when the parent sizes it. */
  aspectRatio?: number;
  radius?: number;
  borderWidth?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Absolute-positioned overlays (tags, play badges, insets). */
  children?: ReactNode;
};

/** A photo/video surface: real image when available, mock scene gradient otherwise. */
export function SceneMedia({
  seed,
  uri,
  aspectRatio,
  radius = 0,
  borderWidth = 0,
  borderColor = colors.iron,
  style,
  children
}: SceneMediaProps) {
  const [from, to] = sceneFor(seed);
  return (
    <View
      style={[
        {
          aspectRatio,
          borderRadius: radius,
          borderWidth,
          borderColor,
          overflow: "hidden",
          backgroundColor: colors.graphite
        },
        style
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {/* Legibility gradient (spec §0): 0.12 → transparent 30% → transparent 62% → 0.4 */}
      <LinearGradient
        colors={["rgba(0,0,0,0.12)", "transparent", "transparent", "rgba(0,0,0,0.4)"]}
        locations={[0, 0.3, 0.62, 1]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}

export type FbInsetProps = {
  seed: string;
  uri?: string | null;
  /** Inset width as a fraction of the parent (posts 0.31, calendar minis 0.34). */
  widthPct?: number;
  radius?: number;
  borderWidth?: number;
  /** Offset from the top-left corner (posts 12, calendar minis 4). */
  offset?: number;
  /** Drop shadow (posts use `0 6px 20px rgba(0,0,0,0.55)`). */
  shadow?: boolean;
};

/**
 * Front-camera inset selfie (`.fb-inset`, spec §4.3): top-left, aspect 3/4,
 * black border. Render inside a relatively-positioned SceneMedia.
 */
export function FbInset({
  seed,
  uri,
  widthPct = 0.31,
  radius = 12,
  borderWidth = 2,
  offset = 12,
  shadow = true
}: FbInsetProps) {
  const [from, to] = sceneFor(`${seed}-inset`);
  return (
    <View
      style={{
        position: "absolute",
        top: offset,
        left: offset,
        width: `${widthPct * 100}%`,
        aspectRatio: 3 / 4,
        borderRadius: radius,
        borderWidth,
        borderColor: colors.black,
        overflow: "hidden",
        backgroundColor: colors.charcoal,
        ...(shadow
          ? {
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.55,
              shadowRadius: 20,
              elevation: 8
            }
          : null)
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    </View>
  );
}
