import { Check, Globe, Lock, Users } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

export type Visibility = "public" | "friends" | "private";

const OPTIONS: { key: Visibility; label: string; body: string; icon: typeof Globe }[] = [
  { key: "public", label: "Public", body: "Anyone on Spotted can see your profile.", icon: Globe },
  { key: "friends", label: "Friends", body: "Only friends you've added can see your posts.", icon: Users },
  { key: "private", label: "Private", body: "Only you can see your posts.", icon: Lock }
];

/** Quick bottom-sheet to switch Public / Friends / Private without digging into settings. */
export function VisibilityPicker({
  visible,
  current,
  onSelect,
  onClose
}: {
  visible: boolean;
  current: Visibility;
  onSelect: (value: Visibility) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron,
            paddingBottom: insets.bottom + 12
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate }} />
          </View>
          <Text style={{ paddingTop: 8, paddingHorizontal: 20, fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white }}>
            Who can see you?
          </Text>
          <View style={{ paddingTop: 8 }}>
            {OPTIONS.map((opt) => {
              const active = current === opt.key;
              const Icon = opt.icon;
              return (
                <Pressable key={opt.key} onPress={() => onSelect(opt.key)} accessibilityLabel={opt.label}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 20 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
                      <Icon size={18} color={active ? colors.gold : colors.silver} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{opt.label}</Text>
                      <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>{opt.body}</Text>
                    </View>
                    {active ? <Check size={18} color={colors.gold} strokeWidth={2.6} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
