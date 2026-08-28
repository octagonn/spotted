import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * Settings-screen building blocks, shared by Notifications and Privacy (which
 * had byte-identical local copies of all four): gold pill toggle, hairline
 * row with title/sub + a right slot, chevron nav row, and the mono section
 * label. Rows assume the screen provides its own horizontal padding.
 */

export function SettingToggle({
  value,
  onToggle,
  disabled = false
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={onToggle}
      haptic={false}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 3,
        opacity: disabled ? 0.45 : 1,
        backgroundColor: value ? tokens.accent.gold : colors.iron,
        alignItems: value ? "flex-end" : "flex-start"
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: value ? colors.black : colors.silver
        }}
      />
    </Pressable>
  );
}

export function SettingRow({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.graphite
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{title}</Text>
        {sub ? <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SettingNavRow({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      haptic={false}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.graphite
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: colors.white }}>{title}</Text>
        {sub ? <Text style={{ marginTop: 3, fontSize: 12.5, lineHeight: 17, color: colors.fog }}>{sub}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.fog} />
    </Pressable>
  );
}

export function SettingSectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        marginTop: 26,
        marginBottom: 4,
        fontFamily: "GeistMono_400Regular",
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: colors.mist
      }}
    >
      {children}
    </Text>
  );
}
