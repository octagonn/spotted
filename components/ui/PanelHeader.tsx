import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

type PanelHeaderProps = {
  title: string;
  sub?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  /** Optional trailing slot. */
  right?: ReactNode;
  /** Makes the title/sub block tappable (e.g. open a chat partner's profile). */
  onTitlePress?: () => void;
};

/**
 * Panel header per spec §2.4: 34px back circle (1px iron border, chevron-left mist),
 * title 600/16 white, sub 12 fog; sticky gradient bg black 78% → transparent.
 * Render it as the first (sticky) child of a panel screen — it pads for the status bar.
 */
export function PanelHeader({ title, sub, onBack, right, onTitlePress }: PanelHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ position: "relative" }}>
      <LinearGradient
        colors={["#000000", "#000000", "transparent"]}
        locations={[0, 0.78, 1]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: -14 }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 12
        }}
      >
        <Pressable
          onPress={onBack ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: colors.iron,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <ChevronLeft color={colors.mist} size={18} strokeWidth={2.2} />
          </View>
        </Pressable>
        <Pressable
          style={{ flex: 1 }}
          disabled={!onTitlePress}
          onPress={onTitlePress}
          accessibilityRole={onTitlePress ? "button" : undefined}
        >
          <Text
            numberOfLines={1}
            accessibilityRole={onTitlePress ? undefined : "header"}
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: 16,
              letterSpacing: 16 * -0.01,
              color: colors.white
            }}
          >
            {title}
          </Text>
          {sub ? (
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>
              {sub}
            </Text>
          ) : null}
        </Pressable>
        {right}
      </View>
    </View>
  );
}
