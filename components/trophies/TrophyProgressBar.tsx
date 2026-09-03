import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * Thin progress track with a `current/target` label. Neutral fill while locked;
 * gold once the milestone is earned (gold is reserved for earned trophies).
 */
export function TrophyProgressBar({
  current,
  target,
  unit,
  earned = false,
  showLabel = true,
  toward = null
}: {
  current: number;
  target: number;
  unit?: string;
  earned?: boolean;
  showLabel?: boolean;
  /** Tier the bar is climbing toward — renders "23/30 days to Silver". */
  toward?: string | null;
}) {
  const pct = target > 0 ? Math.max(0, Math.min(1, current / target)) : earned ? 1 : 0;
  return (
    <View style={{ width: "100%" }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: tokens.border.default, overflow: "hidden" }}>
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            borderRadius: 2,
            backgroundColor: earned ? tokens.accent.gold : colors.silver
          }}
        />
      </View>
      {showLabel ? (
        <Text variant="mono" className="mt-1">
          {`${current}/${target}${unit ? ` ${unit}` : ""}${toward ? ` to ${toward}` : ""}`}
        </Text>
      ) : null}
    </View>
  );
}
