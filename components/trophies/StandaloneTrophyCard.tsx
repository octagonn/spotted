import { Text, View } from "react-native";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { TrophyRarity } from "@/components/trophies/TrophyRarity";
import { Pressable } from "@/components/ui/Pressable";
import { type TrophyCardModel } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";

/**
 * A single-badge trophy card (Categories tab). Earned shows a gold icon + name +
 * "Earned"; locked shows a dim icon + name + short requirement. Rarity always
 * shows. A progress bar only appears for the one progress-tracked standalone
 * (Nomad) — never a zero bar on event badges.
 */
export function StandaloneTrophyCard({ card, width, onPress }: { card: TrophyCardModel; width: number; onPress: () => void }) {
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

        <Text numberOfLines={2} style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, lineHeight: 15, textAlign: "center", color: earned ? colors.white : colors.silver }}>
          {card.def.name}
        </Text>

        {earned ? (
          <Text style={{ fontFamily: "Geist_400Regular", fontSize: 10, color: colors.gold }}>Earned</Text>
        ) : (
          <Text numberOfLines={2} style={{ fontFamily: "Geist_400Regular", fontSize: 10, lineHeight: 13, textAlign: "center", color: colors.fog }}>
            {card.requirement}
          </Text>
        )}

        {card.progress ? (
          <View style={{ width: "100%", paddingHorizontal: 2 }}>
            <TrophyProgressBar current={card.progress.current} target={card.progress.target} unit={card.progress.unit} earned={earned} toward={card.progress.toward} />
          </View>
        ) : null}

        <View style={{ flex: 1 }} />
        <TrophyRarity pct={card.rarityPct} />
      </View>
    </Pressable>
  );
}
