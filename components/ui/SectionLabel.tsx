import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";

type SectionLabelProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Section label per spec §2.6: mono 10.5, ls 0.12em, uppercase, fog, padding 18 18 10. */
export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <View style={[{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10 }, style]}>
      <Text
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
    </View>
  );
}

/** Hairline per spec §2.6: 1px iron rule, 18px horizontal margin. */
export function Hairline({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: colors.iron, marginHorizontal: 18 }, style]} />;
}
