import type { ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, type ViewStyle } from "react-native";

/**
 * Shared keyboard wrapper so text-entry screens behave consistently: the
 * focused input stays visible above the keyboard, and tapping the background
 * dismisses it. `padding` on iOS + `height` on Android is the combination that
 * tracks the keyboard reliably across both platforms (Android also relies on
 * the app's default adjustResize soft-input mode).
 *
 * Wrap the screen body; put scrollables inside with
 * `keyboardShouldPersistTaps="handled"` so the first outside tap still lands on
 * its target.
 */
export function KeyboardAwareScreen({
  children,
  style,
  offset = 0,
  dismissOnTap = true
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** keyboardVerticalOffset — set to a header/nav height when one sits above. */
  offset?: number;
  /** Tap on empty background dismisses the keyboard (default true). */
  dismissOnTap?: boolean;
}) {
  const body = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={offset}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
  if (!dismissOnTap) return body;
  return (
    <Pressable accessible={false} onPress={() => Keyboard.dismiss()} style={{ flex: 1 }}>
      {body}
    </Pressable>
  );
}
