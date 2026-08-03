import { Text, View } from "react-native";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyRarity } from "@/components/trophies/TrophyRarity";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { Pressable } from "@/components/ui/Pressable";
import { formatRarity } from "@/lib/trophyRaritySeeds";
import { type EarnedEntry } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";

/**
 * Earned tab card. Every earned tier/standalone is its own entry: gold icon,
 * name (tier name for stacked), the family name when it's a tier, "Earned", the
 * exact achievement date, and the rarity percentage — all always visible.
 */
export function EarnedTrophyCard({ entry, width, onPress }: { entry: EarnedEntry; width: number; onPress: () => void }) {
  const date = formatEarnedDate(entry.earnedAt);
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${entry.displayName}, ${formatRarity(entry.rarityPct)}`} haptic={false}>
      <View
        style={{
          width,
          minHeight: 168,
          paddingVertical: 15,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.iron,
          backgroundColor: colors.graphite,
          alignItems: "center",
          gap: 6
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.goldSoft
          }}
        >
          <TrophyIcon iconKey={entry.icon} earned size={22} />
        </View>

        {entry.familyName ? (
          <Text numberOfLines={1} style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", color: colors.fog }}>
            {entry.familyName}
          </Text>
        ) : null}
        <Text numberOfLines={2} style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, lineHeight: 15, textAlign: "center", color: colors.white }}>
          {entry.displayName}
        </Text>

        <Text style={{ fontFamily: "Geist_400Regular", fontSize: 10, color: colors.gold }}>Earned</Text>
        {date ? (
          <Text numberOfLines={1} style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: colors.silver }}>
            {date}
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />
        <TrophyRarity pct={entry.rarityPct} />
      </View>
    </Pressable>
  );
}
