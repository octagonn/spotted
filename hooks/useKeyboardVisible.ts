import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Whether the soft keyboard is up. Screens that pad their bottom edge with the
 * home-indicator inset should drop that padding while the keyboard is open —
 * otherwise KeyboardAvoidingView stacks both and leaves a visible gap between
 * the keyboard and the input.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
