import type { ReactNode } from "react";
import { ActivityIndicator, Text, View, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/** "primary"/"danger" are legacy aliases kept so old call sites compile (primary→solid, danger→ghost). */
type ButtonVariant = "solid" | "ghost" | "primary" | "danger";

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  style?: ViewStyle;
  animateLabel?: boolean;
  /** Required when `children` isn't a plain string (e.g. an icon-only button). */
  accessibilityLabel?: string;
};

/**
 * Button per spec §2.2.
 * - solid: white bg, black 700/14 text, radius 12, padding 14×20. Disabled: iron bg, ash text.
 * - ghost: 1px slate border, bone 600/14 text, radius 12, padding 13×20, transparent bg.
 * Press feedback: scale 0.98 + opacity 0.85, 140ms standard.
 */
export function Button({
  children,
  onPress,
  variant = "solid",
  disabled,
  loading,
  icon,
  className,
  style,
  animateLabel = false,
  accessibilityLabel
}: ButtonProps) {
  const solid = variant === "solid" || variant === "primary";

  const container: ViewStyle = solid
    ? {
        backgroundColor: disabled ? colors.iron : colors.white,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20
      }
    : {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.slate,
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 20
      };

  const textColor = solid ? (disabled ? colors.ash : colors.black) : colors.bone;

  return (
    <Pressable
      className={className}
      disabled={disabled || loading}
      onPress={onPress}
      pressScale={0.98}
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ busy: Boolean(loading) }}
    >
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: !solid && disabled ? 0.4 : 1
          },
          container,
          style
        ]}
      >
        {loading ? <ActivityIndicator color={solid ? colors.black : colors.bone} /> : null}
        {!loading && icon ? <View>{icon}</View> : null}
        {animateLabel && typeof children === "string" ? (
          <Animated.Text
            key={children}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(100)}
            style={{
              fontFamily: solid ? "Geist_700Bold" : "Geist_600SemiBold",
              fontSize: 14,
              letterSpacing: 14 * 0.01,
              color: textColor
            }}
          >
            {children}
          </Animated.Text>
        ) : (
          <Text
            style={{
              fontFamily: solid ? "Geist_700Bold" : "Geist_600SemiBold",
              fontSize: 14,
              letterSpacing: 14 * 0.01,
              color: textColor
            }}
          >
            {children}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

type RelButtonProps = {
  label: string;
  /** primary = white pill ("Add"/"Add Back"); quiet = fog text ("✓ Friends"/"Following"/"Added"). */
  kind: "primary" | "quiet";
  onPress?: () => void;
  disabled?: boolean;
};

/** Relationship pill (`.rel-btn`, §2.2): 12px 700, padding 7×16, radius 8, min-width 78. */
export function RelButton({ label, kind, onPress, disabled }: RelButtonProps) {
  const primary = kind === "primary";
  return (
    <Pressable onPress={onPress} disabled={disabled} pressScale={0.98} accessibilityLabel={label}>
      <View
        style={{
          minWidth: 78,
          paddingVertical: 7,
          paddingHorizontal: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: primary ? colors.white : colors.iron,
          backgroundColor: primary ? colors.white : "transparent",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text
          style={{
            fontFamily: "Geist_700Bold",
            fontSize: 12,
            letterSpacing: 12 * 0.02,
            color: primary ? colors.black : colors.fog
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
