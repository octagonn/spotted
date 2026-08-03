import { Text, View } from "react-native";

import { formatRarity, PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";

/**
 * The canonical rarity line — always the exact "X% of users" percentage, never a
 * bucket word. Sub-1% trophies get a subtle gold dot as a premium cue, but the
 * text stays numerical.
 */
export function TrophyRarity({
  pct,
  size = 9.5,
  align = "center"
}: {
  pct: number;
  size?: number;
  align?: "center" | "flex-start";
}) {
  const premium = pct < PREMIUM_RARITY_THRESHOLD;
  return (
    <View
      accessible
      accessibilityLabel={formatRarity(pct)}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: align === "center" ? "center" : "flex-start", gap: 5 }}
    >
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: premium ? colors.gold : colors.ash
        }}
      />
      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: size, letterSpacing: 0.2, color: premium ? colors.gold : colors.fog }}>
        {formatRarity(pct)}
      </Text>
    </View>
  );
}
