import { Text, View } from "react-native";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { TrophyRarity } from "@/components/trophies/TrophyRarity";
import { Pressable } from "@/components/ui/Pressable";
import { type TrophyCardModel } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";

/**
 * One card for an entire stacked family (Categories tab). Earned families show
 * the highest earned tier in gold; unearned show the first locked tier dimmed
 * with its requirement. Always shows the tier position and the displayed tier's
 * rarity. A progress bar appears only for auto-tracked families (streaks,
 * weekend warrior, home turf) — never for video-verified strength.
 */
export function StackedTrophyCard({ card, width, onPress }: { card: TrophyCardModel; width: number; onPress: () => void }) {
  const earned = card.earned;
  return (
    <Pressable onPress={onPress} accessibilityLabel={card.def.name} haptic={false}>
      <View
        style={{
          width,
          minHeight: 158,
          paddingVertical: 15,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: earned ? colors.iron : colors.graphite,
          backgroundColor: colors.graphite,
          alignItems: "center",
          gap: 7
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: earned ? colors.goldSoft : colors.charcoal,
            borderWidth: earned ? 0 : 1,
            borderColor: colors.iron
          }}
        >
          <TrophyIcon iconKey={card.def.icon} earned={earned} size={22} />
        </View>

        <Text numberOfLines={1} style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", color: colors.fog }}>
          {card.def.name}
        </Text>
        <Text numberOfLines={2} style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, lineHeight: 15, textAlign: "center", color: earned ? colors.white : colors.silver }}>
          {card.displayName}
        </Text>

        {earned ? (
          <Text style={{ fontFamily: "Geist_400Regular", fontSize: 10, color: colors.gold }}>Earned</Text>
        ) : card.requirement ? (
          <Text numberOfLines={1} style={{ fontFamily: "Geist_400Regular", fontSize: 10, color: colors.fog }}>{card.requirement}</Text>
        ) : null}

        {card.progress ? (
          <View style={{ width: "100%", paddingHorizontal: 2 }}>
            <TrophyProgressBar current={card.progress.current} target={card.progress.target} unit={card.progress.unit} earned={earned} />
          </View>
        ) : null}

        {/* Tier position dots + count */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
            {Array.from({ length: card.totalTiers }, (_, i) => (
              <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: i < card.earnedTierCount ? colors.gold : colors.iron }} />
            ))}
          </View>
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, color: colors.fog }}>{card.tierPosition}</Text>
        </View>

        <TrophyRarity pct={card.rarityPct} />
      </View>
    </Pressable>
  );
}
