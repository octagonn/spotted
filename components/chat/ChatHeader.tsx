import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { icon, space, tokens } from "@/theme/tokens";

type ChatHeaderProps = {
  title: string;
  avatarUrl?: string | null;
  /** Presence line / member count — rendered under the title. */
  subtitle?: ReactNode;
  /** Spoken alongside the title (live presence isn't announced on its own). */
  accessibilityHint?: string;
  onBack: () => void;
  /** Tapping the identity block opens the conversation details. */
  onOpenDetails?: () => void;
};

/** Chat header: back · avatar + name + presence. The whole identity block opens details. */
export function ChatHeader({ title, avatarUrl, subtitle, accessibilityHint, onBack, onOpenDetails }: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
        paddingTop: insets.top + space[1] + 2,
        paddingHorizontal: space[2],
        paddingBottom: space[2] + 2,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border.subtle
      }}
    >
      <Pressable onPress={onBack} haptic="none" accessibilityLabel="Back" hitSlop={8} style={{ padding: space[2] }}>
        <ChevronLeft size={icon.size.md + 2} color={tokens.text.primary} strokeWidth={icon.stroke.bold} />
      </Pressable>
      <Pressable
        onPress={onOpenDetails}
        disabled={!onOpenDetails}
        haptic="none"
        accessibilityLabel={`Open ${title} details${accessibilityHint ? `, ${accessibilityHint}` : ""}`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[3], paddingRight: space[3] }}
      >
        <Avatar name={title} uri={avatarUrl} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="subheading" numberOfLines={1}>
            {title}
          </Text>
          {subtitle}
        </View>
      </Pressable>
    </View>
  );
}
