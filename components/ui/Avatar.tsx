import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Text, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { colors } from "@/theme/colors";

/** 8 avatar fallback gradients from spec §2.1 (140deg). */
const GRADIENTS: readonly [string, string][] = [
  ["#3F3F46", "#18181B"],
  ["#52525B", "#27272A"],
  ["#2E2E33", "#0F0F11"],
  ["#47474E", "#1C1C1F"],
  ["#5A5A63", "#2E2E33"],
  ["#39393F", "#121214"],
  ["#6B6B74", "#3F3F46"],
  ["#26262B", "#0A0A0A"]
];

function gradientFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/** Legacy string sizes kept so existing call sites compile (old xs/sm/md/lg mapping). */
const LEGACY_SIZES = { xs: 32, sm: 40, md: 56, lg: 96 } as const;

export type AvatarProps = {
  /** Display name — drives the initial + deterministic gradient fallback. */
  name?: string;
  uri?: string | null;
  /** Size in px (spec uses 24–72). Legacy "xs"|"sm"|"md"|"lg" still accepted. */
  size?: number | keyof typeof LEGACY_SIZES;
  /** Circle by default; `square` = 10px-radius square (`.av.sq`). */
  rounded?: "circle" | "square";
  /** Border override (e.g. 2px black for overlap stacks). Default 1px iron. */
  borderColor?: string;
  borderWidth?: number;
  muted?: boolean;
  /**
   * A11y (WCAG 1.1.1): most avatars sit next to the person's name, so by
   * default the avatar is decorative (hidden from screen readers) to avoid a
   * double-read and to stop the fallback initial from being announced as a lone
   * letter. Pass `accessibilityLabel` for a STANDALONE avatar (no adjacent
   * name) to expose it with role "image".
   */
  accessibilityLabel?: string;
};

/**
 * Avatar per spec §2.1 — circle, 1px iron border, gradient sheen; real image or
 * initial + deterministic gradient fallback.
 */
export function Avatar({
  name = "?",
  uri,
  size = 40,
  rounded = "circle",
  borderColor = colors.iron,
  borderWidth = 1,
  muted,
  accessibilityLabel
}: AvatarProps) {
  const px = typeof size === "number" ? size : LEGACY_SIZES[size];
  const radius = rounded === "circle" ? px / 2 : 10;
  const [from, to] = gradientFor(name);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const meaningful = Boolean(accessibilityLabel);

  return (
    <View
      accessible={meaningful}
      accessibilityRole={meaningful ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      // Decorative by default: hide the initial/image from screen readers so it
      // doesn't read as a lone letter next to the name it accompanies.
      importantForAccessibility={meaningful ? "yes" : "no-hide-descendants"}
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        borderWidth,
        borderColor,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        opacity: muted ? 0.4 : 1
      }}
    >
      {uri ? (
        // expo-image (memory+disk cache): avatar URLs are public and stable, so
        // every avatar in the app renders from cache after first sight.
        <CachedImage source={{ uri }} contentFit="cover" style={{ width: px, height: px }} />
      ) : (
        <>
          <LinearGradient
            colors={[from, to]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Text
            style={{
              fontFamily: "Geist_700Bold",
              fontSize: Math.round(px * 0.4),
              color: colors.mist
            }}
          >
            {initial}
          </Text>
        </>
      )}
      {/* Sheen: linear-gradient(160deg, rgba(255,255,255,0.10), transparent 55%) */}
      <LinearGradient
        colors={["rgba(255,255,255,0.10)", "transparent"]}
        locations={[0, 0.55]}
        start={{ x: 0.35, y: 0 }}
        end={{ x: 0.65, y: 1 }}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

export type GroupAvatarProps = {
  /** Names of the first two members. */
  names: [string, string] | string[];
  uris?: (string | null | undefined)[];
  /** Container size (spec: 46). */
  size?: number;
};

/** Group avatar (§2.1): two 30px avatars overlapped diagonally inside a 46px box. */
export function GroupAvatar({ names, uris, size = 46 }: GroupAvatarProps) {
  const inner = Math.round(size * (30 / 46));
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <Avatar name={names[0] ?? "?"} uri={uris?.[0]} size={inner} borderColor={colors.black} borderWidth={2} />
      </View>
      <View style={{ position: "absolute", bottom: 0, right: 0 }}>
        <Avatar name={names[1] ?? "?"} uri={uris?.[1]} size={inner} borderColor={colors.black} borderWidth={2} />
      </View>
    </View>
  );
}

export type LiveRingProps = {
  children: ReactNode;
  /** Outer ring diameter (spec: 56 on the live strip, 82 on the spot sheet). */
  size?: number;
  /** Live = white pulsing ring; offline = static iron ring. */
  live?: boolean;
};

/**
 * Live-presence ring (§4.5): 1.5px ring, white + ringpulse when live
 * (reduce-motion gated), iron when offline. Wrap an <Avatar> in it.
 */
export function LiveRing({ children, size = 56, live = false }: LiveRingProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (live && !reducedMotion) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [live, reducedMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.25 }],
    opacity: 0.25 * (1 - pulse.value)
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {live ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "rgba(255,255,255,0.25)"
            },
            pulseStyle
          ]}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: live ? colors.white : colors.iron,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {children}
      </View>
    </View>
  );
}
