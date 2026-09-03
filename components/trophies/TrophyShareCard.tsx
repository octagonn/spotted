import { Image } from "expo-image";
import { View } from "react-native";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { Text } from "@/components/ui/Text";
import { resolveMedal } from "@/lib/trophyMedal";
import { medalArt, medalGlyphColor } from "@/lib/trophyMedalArt";
import { formatRarity } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

export type TrophyShareData = {
  icon: string;
  name: string;
  familyName?: string | null;
  earnedAt?: string | null;
  rarityPct: number;
  /** Tier medal (spec): drives the celebration colors; null for non-tiered. */
  medal?: "bronze" | "silver" | "gold" | "diamond" | null;
  /** Instance context for repeatable trophies (gym, month, run start). */
  context?: Record<string, unknown> | null;
};

/**
 * The shareable trophy card — Spotted branding, gold trophy icon, name, exact
 * date, and rarity on a dark zinc background with restrained gold accents.
 * Rendered off-screen and captured to an image by the unlock modal's Share.
 */
export function TrophyShareCard({ data }: { data: TrophyShareData }) {
  const date = formatEarnedDate(data.earnedAt);
  const displayMedal = resolveMedal(data.medal, data.rarityPct);
  return (
    <View
      style={{
        width: 340,
        paddingVertical: space[8] + 2,
        paddingHorizontal: space[6] + 4,
        borderRadius: radius.lg,
        backgroundColor: colors.ink,
        borderWidth: 1,
        borderColor: tokens.border.default,
        alignItems: "center"
      }}
    >
      <Text variant="display-sm" className="text-[15px] leading-[20px] tracking-[1px]" maxFontSizeMultiplier={1.4}>
        SPOTTED
      </Text>
      <Text variant="micro" className="mt-1 text-gold">
        Trophy Unlocked
      </Text>

      <View
        style={{
          marginTop: space[6] - 2,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.goldSoft,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Image
          source={medalArt(displayMedal)}
          style={{ position: "absolute", width: 90, height: 90 }}
          contentFit="contain"
          accessible={false}
        />
        <TrophyIcon iconKey={data.icon} earned size={33} color={medalGlyphColor(displayMedal)} />
      </View>

      {data.familyName ? (
        <Text variant="micro" className="mt-[18px]">
          {data.familyName}
        </Text>
      ) : null}
      <Text
        variant="heading"
        className={`text-center text-[22px] leading-[28px] ${data.familyName ? "mt-1" : "mt-[18px]"}`}
      >
        {data.name}
      </Text>

      <View style={{ marginTop: space[4], alignSelf: "stretch", height: 1, backgroundColor: colors.graphite }} />

      <View
        style={{ marginTop: space[3] + 2, flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch" }}
      >
        <View>
          <Text variant="micro">Earned</Text>
          <Text variant="meta-strong" className="mt-[3px] text-white">
            {date ?? "Today"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text variant="micro">Rarity</Text>
          <Text variant="meta-strong" className="mt-[3px] text-gold">
            {formatRarity(data.rarityPct)}
          </Text>
        </View>
      </View>
    </View>
  );
}
