import { useState } from "react";
import { Modal, Pressable, Text } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import EmojiPicker from "rn-emoji-keyboard";

import { colors } from "@/theme/colors";

/** Quick-bar emoji, iMessage-style. The + opens the full picker. */
const QUICK_EMOJI = ["❤️", "😂", "🔥", "💪", "😮", "😢"];

export type MessageAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * Long-press menu for a chat message: an emoji quick-bar (any emoji via the
 * full picker behind "+") above the action list — replaces the old
 * three-hardcoded-reactions alert.
 */
export function MessageActionMenu({
  visible,
  onClose,
  onReact,
  actions
}: {
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  actions: MessageAction[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const react = (emoji: string) => {
    onReact(emoji);
    setPickerOpen(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent accessibilityViewIsModal>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <Animated.View entering={ZoomIn.springify().damping(16).mass(0.6)} style={{ alignSelf: "stretch", alignItems: "center" }}>
          {/* Emoji quick bar */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.graphite,
              borderWidth: 1,
              borderColor: colors.iron
            }}
          >
            {QUICK_EMOJI.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityLabel={`React ${emoji}`}
                onPress={() => react(emoji)}
                hitSlop={4}
                style={({ pressed }) => ({
                  paddingHorizontal: 5,
                  transform: [{ scale: pressed ? 1.35 : 1 }]
                })}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityLabel="More emoji"
              onPress={() => setPickerOpen(true)}
              hitSlop={4}
              style={{
                marginLeft: 2,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.charcoal,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontSize: 19, color: colors.mist, lineHeight: 22 }}>＋</Text>
            </Pressable>
          </Pressable>

          {/* Action list */}
          <Animated.View
            entering={FadeIn.delay(40)}
            style={{
              marginTop: 12,
              alignSelf: "stretch",
              maxWidth: 340,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: colors.graphite,
              borderWidth: 1,
              borderColor: colors.iron
            }}
          >
            {actions.map((action, index) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.iron,
                  backgroundColor: pressed ? colors.charcoal : "transparent"
                })}
              >
                <Text
                  style={{
                    fontFamily: "Geist_500Medium",
                    fontSize: 15,
                    color: action.destructive ? "#FF5C5C" : colors.white
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      </Pressable>

      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onEmojiSelected={(e) => react(e.emoji)}
        enableSearchBar
        theme={{
          backdrop: "rgba(0,0,0,0.6)",
          knob: colors.slate,
          container: colors.graphite,
          header: colors.mist,
          category: { icon: colors.mist, iconActive: colors.white, container: colors.charcoal, containerActive: colors.iron },
          search: { text: colors.white, placeholder: colors.fog, icon: colors.fog, background: colors.charcoal }
        }}
      />
    </Modal>
  );
}
