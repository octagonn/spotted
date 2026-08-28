import { Check, Lock } from "lucide-react-native";
import { Text, View } from "react-native";

import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { formatRarity } from "@/lib/trophyRaritySeeds";
import { type LadderRow } from "@/lib/trophySelectors";
import { type TrophyDefinition } from "@/lib/trophies";
import { medalColors, medalLabel } from "@/lib/trophyMedal";
import { colors } from "@/theme/colors";

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
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: earned ? medalColors(tier.medal).solid : "transparent",
          borderWidth: earned ? 0 : 1.5,
          borderColor: isNext ? medalColors(tier.medal).solid : colors.iron
        }}
      >
        {earned ? (
          <Check size={14} color={colors.black} strokeWidth={3} />
        ) : isNext ? (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: medalColors(tier.medal).solid }} />
        ) : (
          <Lock size={11} color={colors.ash} strokeWidth={2} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: earned ? colors.white : isNext ? colors.bone : colors.silver }}>
          {tier.name}
        </Text>
        <Text style={{ marginTop: 1, fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>
          {medalLabel(tier.medal) ? `${medalLabel(tier.medal)} · ` : ""}{tier.requirement} · {formatRarity(tier.rarityPct)}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", minWidth: 68 }}>
        {earned ? (
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.gold, textAlign: "right" }}>{date ?? "Earned"}</Text>
        ) : showBar && progress ? (
          <View style={{ width: 68 }}>
            <TrophyProgressBar current={progress.current} target={tier.value} unit={def.unit} showLabel />
          </View>
        ) : (
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.ash }}>Locked</Text>
        )}
      </View>
    </View>
  );
}
