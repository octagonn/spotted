import type { ReactNode } from "react";
import { useState } from "react";
import {
  Pressable as NativePressable,
  type PressableProps as NativePressableProps,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { selectionHaptic } from "@/lib/haptics";

type PressableProps = Omit<NativePressableProps, "style"> & {
  children: ReactNode;
  className?: string;
  /** Extra classes applied while pressed (legacy API — the scale/opacity feedback always runs). */
  pressedClassName?: string;
  haptic?: boolean;
  /** Press-feedback scale target. Spec default 0.965; buttons use 0.98, tab icons 0.9. */
  pressScale?: number;
  /** Press-feedback opacity target (spec default 0.85). */
  pressOpacity?: number;
  /** Static styles — merged with the press-feedback style. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared pressable with the spec press feedback (§1.5): scale 0.965 + opacity
 * 0.85 while pressed.
 *
 * Deliberately built on the core RN Pressable: NativeWind pre-registers it,
 * so `className` resolves through the same path as View/Text. The previous
 * implementation wrapped it in Reanimated's createAnimatedComponent + a manual
 * cssInterop, which silently dropped every className on device — cards lost
 * their borders/padding and flex layouts collapsed.
 */
export function Pressable({
  children,
  className,
  pressedClassName,
  haptic = true,
  pressScale = 0.965,
  pressOpacity = 0.85,
  style,
  onPressIn,
  onPressOut,
  accessibilityRole,
  accessibilityState,
  hitSlop,
  disabled,
  ...props
}: PressableProps) {
  const [pressed, setPressed] = useState(false);

  // A11y defaults (WCAG 4.1.2 / 2.5.5): anything with a press handler is a
  // button to a screen reader unless the caller says otherwise (link, checkbox,
  // radio, tab, adjustable). `disabled` is always reflected in state, and a
  // default hitSlop lifts small icon controls toward the 44×44 target without
  // changing layout. Callers still override any of these via props.
  const isInteractive = Boolean(props.onPress || props.onLongPress);
  const resolvedRole = accessibilityRole ?? (isInteractive ? "button" : undefined);
  const resolvedState = { disabled: Boolean(disabled), ...(accessibilityState ?? {}) };

  return (
    <NativePressable
      {...props}
      disabled={disabled}
      accessibilityRole={resolvedRole}
      accessibilityState={resolvedState}
      hitSlop={hitSlop ?? (isInteractive ? 8 : undefined)}
      className={[className, pressed ? pressedClassName : ""].filter(Boolean).join(" ")}
      style={[style, pressed ? { transform: [{ scale: pressScale }], opacity: pressOpacity } : null]}
      onPressIn={(event) => {
        setPressed(true);
        if (haptic) {
          void selectionHaptic();
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
    >
      {children}
    </NativePressable>
  );
}
