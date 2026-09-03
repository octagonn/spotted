import { Check, Lock } from "lucide-react-native";
import { View } from "react-native";

import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { Text } from "@/components/ui/Text";
import { type TrophyDefinition } from "@/lib/trophies";
import { medalColors, medalLabel } from "@/lib/trophyMedal";
import { formatRarity } from "@/lib/trophyRaritySeeds";
import { type LadderRow } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

/**
 * One rung of a stacked tier ladder. Earned rows are gold with a check + exact
 * date; the next locked row (for auto-tracked families) shows a live progress
 * bar; further locked rows just show the requirement — never a fabricated date.
 * Every row shows the tier's exact rarity percentage.
 */
export function TrophyTierRow({
  def,
  row,
  progress
}: {
  def: TrophyDefinition;
  row: LadderRow;
  /** Live progress for the "next" row (auto-tracked families only). */
  progress?: { current: number; target: number; unit?: string } | null;
}) {
  const { tier, earned, isNext } = row;
  const date = formatEarnedDate(row.earnedAt);
  const showBar = isNext && def.trackingType === "progress" && Boolean(progress);
  const medal = medalColors(tier.medal);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingVertical: space[2] + 3,
        borderBottomWidth: 1,
        borderBottomColor: colors.graphite
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: earned ? medal.solid : "transparent",
          borderWidth: earned ? 0 : 1.5,
          borderColor: isNext ? medal.solid : tokens.border.default
        }}
      >
        {earned ? (
          <Check size={14} color={colors.black} strokeWidth={3} />
        ) : isNext ? (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: medal.solid }} />
        ) : (
          <Lock size={11} color={colors.ash} strokeWidth={icon.stroke.regular} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="username" className={earned ? "" : isNext ? "text-bone" : "text-silver"}>
          {tier.name}
        </Text>
        <Text variant="mono" className="mt-[1px]">
          {`${medalLabel(tier.medal) ? `${medalLabel(tier.medal)} · ` : ""}${tier.requirement} · ${formatRarity(tier.rarityPct)}`}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", minWidth: 68 }}>
        {earned ? (
          <Text variant="mono" className="text-right text-gold">
            {date ?? "Earned"}
          </Text>
        ) : showBar && progress ? (
          <View style={{ width: 68 }}>
            <TrophyProgressBar current={progress.current} target={tier.value} unit={def.unit} showLabel />
          </View>
        ) : (
          <Text variant="mono" className="text-ash">
            Locked
          </Text>
        )}
      </View>
    </View>
  );
}
