import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { tierPrimary, type EvaluatedTrophy, type StackedTrophyDef } from "@/lib/trophies";
import { rarityColor, type Rarity } from "@/lib/trophyRarity";
import { colors } from "@/theme/colors";

/** Small "3/9" + dot row so it's clear a stacked card has a ladder inside. */
function TierIndicator({ earned, total }: { earned: number; total: number }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < earned ? colors.gold : colors.iron
            }}
          />
        ))}
      </View>
      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, color: colors.fog }}>
        {earned}/{total}
      </Text>
    </View>
  );
}

/**
 * One trophy in the case. Earned = gold icon + name (+ highest tier value).
 * Locked = dim icon + name + short requirement. Stacked cards show a tier
 * indicator and, when trackable, a progress bar; tapping them opens the ladder.
 */
export function TrophyCard({
  trophy,
  width,
  rarity,
  onPress
}: {
  trophy: EvaluatedTrophy;
  width: number;
  rarity?: Rarity;
  onPress?: () => void;
}) {
  const { def, earned } = trophy;
  const stacked = def.kind === "stacked";
  const showBar = (stacked && (def as StackedTrophyDef).trackable) || (def.kind === "standalone" && Boolean(def.progress));

  // The line under the name: earned value, or the short requirement / next target.
  let stateLine: string | null = null;
  let stateColor: string = colors.fog;
  if (stacked) {
    const sdef = def as StackedTrophyDef;
    if (trophy.highestTier) {
      stateLine = tierPrimary(sdef, trophy.highestTier);
      stateColor = colors.gold;
    } else if (trophy.nextTier) {
      stateLine = tierPrimary(sdef, trophy.nextTier);
      stateColor = colors.fog;
    }
  } else if (earned) {
    stateLine = "Earned";
    stateColor = colors.gold;
  } else if (!def.progress) {
    stateLine = def.requirement;
    stateColor = colors.fog;
  }

  const body = (
    <View
      style={{
        width,
        minHeight: 150,
        paddingVertical: 15,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: earned ? colors.iron : colors.graphite,
        backgroundColor: colors.graphite,
        alignItems: "center",
        gap: 8
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
        <TrophyIcon iconKey={def.iconKey} earned={earned} size={22} />
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontFamily: "Geist_600SemiBold",
          fontSize: 12,
          lineHeight: 15,
          textAlign: "center",
          color: earned ? colors.white : colors.silver
        }}
      >
        {def.name}
      </Text>

      {stateLine ? (
        <Text numberOfLines={2} style={{ fontFamily: "Geist_400Regular", fontSize: 10, lineHeight: 13, textAlign: "center", color: stateColor }}>
          {stateLine}
        </Text>
      ) : null}

      {showBar && trophy.progress ? (
        <View style={{ width: "100%", paddingHorizontal: 2 }}>
          <TrophyProgressBar
            current={trophy.progress.current}
            target={trophy.progress.target}
            unit={trophy.progress.unit}
            earned={earned}
          />
        </View>
      ) : null}
      {stacked ? <TierIndicator earned={trophy.earnedCount} total={trophy.total} /> : null}

      {rarity ? (
        <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: rarityColor(rarity.label) }} />
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 0.3, color: rarityColor(rarity.label) }}>
            {rarity.label}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={def.name} haptic={false}>
        {body}
      </Pressable>
    );
  }
  return body;
}
