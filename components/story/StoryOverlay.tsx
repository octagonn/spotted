import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/**
 * Bottom overlay panel for the story viewer. The viewer is a fullScreenModal,
 * which renders ABOVE the global sheet host — so options / report / viewers
 * are local overlays with the same grip + surface as the app sheet.
 */
export function StoryOverlay({
  onClose,
  children,
  maxHeight
}: {
  onClose: () => void;
  children: ReactNode;
  maxHeight?: `${number}%`;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onClose}
      accessibilityLabel="Close"
      style={[StyleSheet.absoluteFill, { backgroundColor: tokens.bg.scrim, justifyContent: "flex-end" }]}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        accessible={false}
        style={{
          maxHeight,
          backgroundColor: colors.graphite,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderTopWidth: 1,
          borderColor: tokens.border.default,
          paddingBottom: insets.bottom + space[3]
        }}
      >
        <View style={{ alignItems: "center", paddingTop: space[2] + 2, paddingBottom: space[1] + 2 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.border.strong }} />
        </View>
        {children}
      </Pressable>
    </Pressable>
  );
}
