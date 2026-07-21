import type { ReactNode } from "react";
import {
  Keyboard,
  TouchableWithoutFeedback,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

/** True when the press landed on an editable element (web bubbles clicks from
 *  inputs up to wrappers — dismissing there would blur the field just tapped). */
export function pressedEditable(event: GestureResponderEvent): boolean {
  const target = event?.target as unknown;
  if (target && typeof target === "object") {
    const el = target as { tagName?: string; isContentEditable?: boolean };
    if (el.isContentEditable) return true;
    if (el.tagName && /^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName)) return true;
  }
  return false;
}

/** Dismiss the keyboard unless the tap was on an input. */
export function dismissKeyboardFromPress(event: GestureResponderEvent): void {
  if (!pressedEditable(event)) Keyboard.dismiss();
}

/**
 * App-wide "tap anywhere else to close the keyboard" wrapper. Interactive
 * children (buttons, inputs, lists) win their own touches; taps that land on
 * dead space dismiss the keyboard.
 *
 * CRITICAL: the wrapper is fully inert (`disabled`) while the keyboard is
 * closed — that's ~99% of the time, including all feed scrolling and story
 * browsing. Participating in every touch's responder negotiation when there's
 * nothing to dismiss caused stuck-scroll bugs after keyboard sessions.
 */
export function DismissKeyboard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const keyboardVisible = useKeyboardVisible();
  return (
    <TouchableWithoutFeedback
      disabled={!keyboardVisible}
      onPress={dismissKeyboardFromPress}
      accessible={false}
    >
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </TouchableWithoutFeedback>
  );
}
