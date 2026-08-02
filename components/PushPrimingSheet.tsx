import { Bell } from "lucide-react-native";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * Custom pre-permission screen (spec). Shown AFTER the first post — never at
 * cold launch. Only "Turn on" calls the OS prompt; "Not now" defers it (the
 * caller re-primes after the 3rd post). The system prompt is saved for a moment
 * when the value of alerts is already clear.
 */
export function PushPrimingSheet({
  visible,
  onEnable,
  onDismiss
}: {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron,
            paddingHorizontal: 28,
            paddingTop: 28,
            paddingBottom: insets.bottom + 20,
            alignItems: "center"
          }}
        >
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              borderWidth: 1.5,
              borderColor: tokens.accent.gold,
              backgroundColor: tokens.accent.goldSubtle,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Bell size={26} color={tokens.accent.gold} strokeWidth={2} />
          </View>
          <Text style={{ marginTop: 20, fontFamily: "Boldonse_400Regular", fontSize: 18, lineHeight: 26, color: colors.white, textAlign: "center" }}>
            Know when your friends hit the gym
          </Text>
          <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 21, color: colors.mist, textAlign: "center" }}>
            Get friend check-ins, messages, reactions, and one daily reminder. You can tune every category and quiet hours anytime.
          </Text>

          <Pressable onPress={onEnable} accessibilityLabel="Turn on notifications" style={{ alignSelf: "stretch", marginTop: 24 }}>
            <View style={{ backgroundColor: colors.white, borderRadius: 999, paddingVertical: 15, alignItems: "center" }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.black }}>Turn on</Text>
            </View>
          </Pressable>
          <Pressable onPress={onDismiss} accessibilityLabel="Not now" style={{ alignSelf: "stretch", marginTop: 8, paddingVertical: 13, alignItems: "center" }}>
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.silver }}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
