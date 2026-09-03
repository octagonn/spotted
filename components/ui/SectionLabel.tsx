import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";

type SectionLabelProps = {
  children: ReactNode;
  style?: ViewStyle;
  /** Trailing action (e.g. "New crew", "Have a code?") on the label's baseline. */
  right?: ReactNode;
};

/** Section label per spec §2.6: mono 10.5, ls 0.12em, uppercase, fog, padding 18 18 10. */
export function SectionLabel({ children, style, right }: SectionLabelProps) {
  return (
    <View
      style={[
        { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10 },
        right ? { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" } : null,
        style
      ]}
    >
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: "GeistMono_400Regular",
          fontSize: 10.5,
          letterSpacing: 10.5 * 0.12,
          textTransform: "uppercase",
          color: colors.fog
        }}
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

/** Hairline per spec §2.6: 1px iron rule, 18px horizontal margin. */
export function Hairline({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: colors.iron, marginHorizontal: 18 }, style]} />;
}
