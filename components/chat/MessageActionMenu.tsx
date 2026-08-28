import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import EmojiPicker from "rn-emoji-keyboard";

import { colors } from "@/theme/colors";

/** Quick-bar emoji, iMessage-style. The + opens the full picker. */
const QUICK_EMOJI = ["❤️", "😂", "🔥", "💪", "😮", "😢"];

export type MessageAction = {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * Long-press context menu for a chat message — iMessage-style: blurred
 * backdrop, the pressed message echoed as a bubble, a floating emoji quick-bar
 * (full picker behind "+"), then an icon action sheet. Destructive actions sit
 * last, separated by a heavier divider.
 */
export function MessageActionMenu({
  visible,
  onClose,
  onReact,
  actions,
  preview
}: {
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  actions: MessageAction[];
  /** The pressed message, echoed above the menu for context. */
  preview?: { text: string | null; mine: boolean } | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [visible]);

  const react = (emoji: string) => {
    void Haptics.selectionAsync().catch(() => {});
    onReact(emoji);
    setPickerOpen(false);
    onClose();
  };

  // NOTE: RN Pressable's function-form `style={({pressed}) => ...}` silently
  // drops every style on native here (NativeWind interop bug) — the menu rows
  // rendered as an unstyled stack. Press feedback must use state + a static
  // style object (see ActionRowItem / QuickEmojiButton below).

  // Destructive actions group at the bottom under a heavier divider.
  const primary = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);
  const ordered = [...primary, ...destructive];
  const firstDestructiveIndex = primary.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent accessibilityViewIsModal>
      {/* Blurred, dimmed backdrop — tap anywhere to dismiss. */}
      <BlurView intensity={Platform.OS === "ios" ? 42 : 90} tint="dark" style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Dismiss message menu"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 24 }}
        >
          <View pointerEvents="box-none" style={{ alignItems: "stretch", gap: 14 }}>
            {/* The message being acted on, echoed as its bubble. */}
            {preview?.text ? (
              <Animated.View
                entering={FadeInDown.springify().damping(18)}
                style={{
                  alignSelf: preview.mine ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  paddingVertical: 11,
                  paddingHorizontal: 15,
                  borderRadius: 20,
                  borderBottomRightRadius: preview.mine ? 6 : 20,
                  borderBottomLeftRadius: preview.mine ? 20 : 6,
                  backgroundColor: preview.mine ? colors.white : colors.graphite,
                  borderWidth: preview.mine ? 0 : 1,
                  borderColor: colors.iron
                }}
              >
                <Text numberOfLines={4} style={{ fontSize: 15, lineHeight: 20, color: preview.mine ? colors.black : colors.bone }}>
                  {preview.text}
                </Text>
              </Animated.View>
            ) : null}

            {/* Emoji quick bar — floating pill. */}
            <Animated.View entering={ZoomIn.springify().damping(15).mass(0.6)} style={{ alignSelf: "center" }}>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 2,
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: "rgba(28,28,31,0.96)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  shadowColor: "#000",
                  shadowOpacity: 0.5,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 12
                }}
              >
                {QUICK_EMOJI.map((emoji, i) => (
                  <Animated.View key={emoji} entering={ZoomIn.delay(24 * i).springify().damping(13)}>
                    <QuickEmojiButton emoji={emoji} onPress={() => react(emoji)} />
                  </Animated.View>
                ))}
                <Pressable
                  accessibilityLabel="More emoji"
                  onPress={() => setPickerOpen(true)}
                  hitSlop={4}
                  style={{
                    marginLeft: 4,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ fontSize: 20, color: colors.mist, lineHeight: 23 }}>＋</Text>
                </Pressable>
              </Pressable>
            </Animated.View>

            {/* Action sheet — icon rows, destructive grouped at the bottom. */}
            <Animated.View
              entering={FadeIn.delay(60)}
              style={{
                alignSelf: "center",
                width: "100%",
                maxWidth: 300,
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: "rgba(22,22,25,0.97)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                shadowColor: "#000",
                shadowOpacity: 0.5,
                shadowRadius: 30,
                shadowOffset: { width: 0, height: 14 },
                elevation: 14
              }}
            >
              {ordered.map((action, index) => (
                <ActionRowItem
                  key={action.label}
                  action={action}
                  first={index === 0}
                  heavyDivider={index === firstDestructiveIndex && index !== 0}
                  onClose={onClose}
                />
              ))}
            </Animated.View>
          </View>
        </Pressable>
      </BlurView>

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

/** iMessage-style action row: label left, icon right, hairline separators,
 *  heavy divider before the destructive group. */
function ActionRowItem({
  action,
  first,
  heavyDivider,
  onClose
}: {
  action: MessageAction;
  first: boolean;
  heavyDivider: boolean;
  onClose: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const Icon = action.icon;
  const tint = action.destructive ? "#FF5C5C" : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        onClose();
        action.onPress();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 13,
        paddingHorizontal: 18,
        borderTopWidth: first ? 0 : heavyDivider ? 6 : 1,
        borderTopColor: heavyDivider ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.07)",
        backgroundColor: pressed ? "rgba(255,255,255,0.06)" : "transparent"
      }}
    >
      <Text style={{ fontFamily: "Geist_500Medium", fontSize: 15.5, color: tint }}>{action.label}</Text>
      {Icon ? <Icon size={18} color={action.destructive ? "#FF5C5C" : colors.mist} strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** Quick-bar emoji with press pop (state-driven — see NOTE above). */
function QuickEmojiButton({ emoji, onPress }: { emoji: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityLabel={`React ${emoji}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={4}
      style={{
        paddingHorizontal: 6,
        transform: [{ scale: pressed ? 1.35 : 1 }, { translateY: pressed ? -6 : 0 }]
      }}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
    </Pressable>
  );
}
