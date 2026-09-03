import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import type { HapticKind } from "@/lib/haptics";
import { radius, tokens } from "@/theme/tokens";

type IconButtonProps = {
  icon: ReactNode;
  /** Required — an icon-only control has no visible text. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** `ghost`: 1px border square (sits next to Buttons). `plain`: no chrome (headers, overlays). */
  variant?: "ghost" | "plain";
  /** Square side. 44 is the minimum practical touch target. */
  size?: number;
  haptic?: HapticKind;
  style?: ViewStyle;
};

/** Square icon-only button. Pair with `Button` in action rows; use `plain` in headers. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  variant = "ghost",
  size = 44,
  haptic = "none",
  style
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      pressScale={0.96}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.sm,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: tokens.border.strong,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1
        }}
      >
        {icon}
      </View>
    </Pressable>
  );
}
