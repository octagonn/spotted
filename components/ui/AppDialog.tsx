import { Modal, Text, View } from "react-native";
import { create } from "zustand";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/**
 * Spotted-themed replacement for the native iOS Alert. Same call signature as
 * Alert.alert so call sites swap 1:1:
 *
 *   appAlert("Discard workout?", "Nothing is logged yet.", [
 *     { text: "Keep going", style: "cancel" },
 *     { text: "Discard", style: "destructive", onPress: () => ... }
 *   ]);
 *
 * The host renders inside a TRANSPARENT native Modal, so the dialog always
 * layers above whatever presented it — bottom sheets, the comments modal,
 * native modal screens — the same guarantee the OS alert had.
 */

export type AppDialogButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type AppDialogState = {
  dialog: { title: string; message?: string; buttons: AppDialogButton[] } | null;
  show: (title: string, message?: string, buttons?: AppDialogButton[]) => void;
  hide: () => void;
};

const useAppDialogStore = create<AppDialogState>((set) => ({
  dialog: null,
  show: (title, message, buttons) =>
    set({ dialog: { title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] } }),
  hide: () => set({ dialog: null })
}));

/** Drop-in for Alert.alert — Spotted-themed, works from anywhere. */
export function appAlert(title: string, message?: string, buttons?: AppDialogButton[]): void {
  useAppDialogStore.getState().show(title, message, buttons);
}

function DialogButton({ button, onDone, wide }: { button: AppDialogButton; onDone: () => void; wide: boolean }) {
  const destructive = button.style === "destructive";
  const cancel = button.style === "cancel";
  return (
    <Pressable
      onPress={() => {
        onDone();
        button.onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={button.text}
      style={{ flex: wide ? undefined : 1 }}
    >
      <View
        style={{
          height: 46,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
          backgroundColor: destructive ? "rgba(239,68,68,0.12)" : cancel ? "transparent" : colors.white,
          borderWidth: cancel || destructive ? 1 : 0,
          borderColor: destructive ? "rgba(239,68,68,0.45)" : colors.iron
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "Geist_700Bold",
            fontSize: 14,
            color: destructive ? "#EF4444" : cancel ? colors.mist : colors.black
          }}
        >
          {button.text}
        </Text>
      </View>
    </Pressable>
  );
}

/** Mount ONCE at the app root (next to ToastHost). */
export function AppDialogHost() {
  const dialog = useAppDialogStore((state) => state.dialog);
  const hide = useAppDialogStore((state) => state.hide);
  if (!dialog) return null;
  const cancelButton = dialog.buttons.find((b) => b.style === "cancel");
  // Stack vertically for 3+ buttons, or when a label is too long for a
  // half-width pill (side-by-side was truncating "Post my SPOTTED" to
  // "Post my SPOTT…").
  const stacked = dialog.buttons.length > 2 || dialog.buttons.some((b) => b.text.length > 12);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={hide} statusBarTranslucent>
      {/* Backdrop tap = cancel (mirrors the OS alert's cancelable behavior). */}
      <Pressable
        onPress={() => {
          if (!cancelButton) return;
          hide();
          cancelButton.onPress?.();
        }}
        accessibilityLabel="Dismiss"
        haptic={false}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 32 }}
      >
        <Pressable onPress={() => {}} haptic={false} accessibilityLabel={dialog.title} style={{ alignSelf: "stretch" }}>
          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.iron,
              backgroundColor: colors.graphite,
              paddingTop: 22,
              paddingBottom: 16,
              paddingHorizontal: 18
            }}
          >
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 16.5, color: colors.white, textAlign: "center" }}>
              {dialog.title}
            </Text>
            {dialog.message ? (
              <Text
                style={{
                  marginTop: 8,
                  fontFamily: "Geist_400Regular",
                  fontSize: 13,
                  lineHeight: 19,
                  color: colors.silver,
                  textAlign: "center"
                }}
              >
                {dialog.message}
              </Text>
            ) : null}
            <View
              style={{
                marginTop: 18,
                flexDirection: stacked ? "column" : "row",
                gap: 10
              }}
            >
              {dialog.buttons.map((button, index) => (
                <DialogButton key={`${button.text}-${index}`} button={button} onDone={hide} wide={stacked} />
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
