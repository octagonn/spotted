import { Flame, X } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { colors } from "@/theme/colors";

/**
 * Small centered streak popup (replaces the old full-screen streak page).
 * Flame + "[Name] has a [X] day streak!", X to close, dimmed backdrop that
 * closes on tap-outside, subtle scale-in.
 */
export function StreakPopup({
  visible,
  name,
  streak,
  onClose
}: {
  visible: boolean;
  name: string;
  streak: number;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Dimmed backdrop — tap outside to close */}
      <Pressable onPress={onClose} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" }}
        />
        {/* Card — stop propagation so taps inside don't close */}
        <Animated.View entering={ZoomIn.springify().damping(16).mass(0.7)} exiting={FadeOut.duration(120)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: 280,
              paddingVertical: 30,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: colors.graphite,
              borderWidth: 1,
              borderColor: colors.iron,
              alignItems: "center"
            }}
          >
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={10}
              style={{ position: "absolute", top: 12, right: 12 }}
            >
              <X size={18} color={colors.fog} strokeWidth={2.4} />
            </Pressable>

            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: colors.goldSoft,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Flame size={34} color={colors.gold} strokeWidth={2} />
            </View>

            <Text
              style={{
                marginTop: 18,
                fontFamily: "Geist_700Bold",
                fontSize: 17,
                lineHeight: 23,
                textAlign: "center",
                color: colors.white
              }}
            >
              {name} has a{"\n"}
              <Text style={{ color: colors.gold }}>{streak}</Text> day streak!
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
