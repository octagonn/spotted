import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { formatRarity, PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * The canonical rarity line — always the exact "X% of users" percentage, never a
 * bucket word. Sub-1% trophies get a subtle gold dot as a premium cue, but the
 * text stays numerical.
 */
export function TrophyRarity({ pct, align = "center" }: { pct: number; align?: "center" | "flex-start" }) {
  const premium = pct < PREMIUM_RARITY_THRESHOLD;
  return (
    <View
      accessible
      accessibilityLabel={formatRarity(pct)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: 5
      }}
    >
      <View
        style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: premium ? tokens.accent.gold : colors.ash }}
      />
      <Text variant="mono" className={premium ? "text-gold" : ""}>
        {formatRarity(pct)}
      </Text>
    </View>
  );
}
