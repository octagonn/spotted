import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/**
 * Profile stat block: big number (+ optional unit riding the baseline and
 * optional leading icon) over a muted label. `lg` is the own-profile scale,
 * `sm` the other-profile scale — one component so the four hand-rolled
 * copies of this can't drift apart again.
 */
export function Stat({
  value,
  unit,
  label,
  icon,
  size = "lg",
  onPress
}: {
  value: number;
  unit?: string;
  label: string;
  icon?: React.ReactNode;
  size?: "sm" | "lg";
  onPress?: () => void;
}) {
  const sz =
    size === "lg"
      ? { number: 20, unit: 11.5, label: 12.5, labelGap: 5, labelColor: colors.fog }
      : { number: 17, unit: 10.5, label: 11, labelGap: 4, labelColor: colors.silver };
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {icon}
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: sz.number, color: colors.white }}>{value}</Text>
          {unit ? <Text style={{ fontFamily: "Geist_400Regular", fontSize: sz.unit, color: colors.fog }}>{unit}</Text> : null}
        </View>
      </View>
      <Text numberOfLines={1} style={{ marginTop: sz.labelGap, fontFamily: "Geist_400Regular", fontSize: sz.label, color: sz.labelColor }}>
        {label}
      </Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={`${value} ${label}`} haptic={false} style={{ flex: 1, alignItems: "center" }}>
        {body}
      </Pressable>
    );
  }
  return <View style={{ flex: 1, alignItems: "center" }}>{body}</View>;
}
