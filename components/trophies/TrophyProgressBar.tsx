import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Thin progress track with a `current/target` label. Neutral fill while locked;
 * gold once the milestone is earned (gold is reserved for earned trophies).
 */
export function TrophyProgressBar({
  current,
  target,
  unit,
  earned = false,
  showLabel = true
}: {
  current: number;
  target: number;
  unit?: string;
  earned?: boolean;
  showLabel?: boolean;
}) {
  const pct = target > 0 ? Math.max(0, Math.min(1, current / target)) : earned ? 1 : 0;
  return (
    <View style={{ width: "100%" }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.iron, overflow: "hidden" }}>
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            borderRadius: 2,
            backgroundColor: earned ? colors.gold : colors.silver
          }}
        />
      </View>
      {showLabel ? (
        <Text style={{ marginTop: 4, fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: colors.fog }}>
          {current}/{target}
          {unit ? ` ${unit}` : ""}
        </Text>
      ) : null}
    </View>
  );
}
