import { Text, View } from "react-native";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { formatRarity } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";

export type TrophyShareData = {
  icon: string;
  name: string;
  familyName?: string | null;
  earnedAt?: string | null;
  rarityPct: number;
};

/**
 * The shareable trophy card — Spotted branding, gold trophy icon, name, exact
 * date, and rarity on a dark zinc background with restrained gold accents.
 * Rendered off-screen and captured to an image by the unlock modal's Share.
 */
export function TrophyShareCard({ data }: { data: TrophyShareData }) {
  const date = formatEarnedDate(data.earnedAt);
  return (
    <View
      style={{
        width: 340,
        paddingVertical: 34,
        paddingHorizontal: 28,
        borderRadius: 26,
        backgroundColor: colors.ink,
        borderWidth: 1,
        borderColor: colors.iron,
        alignItems: "center"
      }}
    >
      <Text
        allowFontScaling={false}
        style={{ fontFamily: "Boldonse_400Regular", fontSize: 15, letterSpacing: 1, color: colors.white, includeFontPadding: false }}
      >
        SPOTTED
      </Text>
      <Text style={{ marginTop: 4, fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 2, textTransform: "uppercase", color: colors.gold }}>
        Trophy Unlocked
      </Text>

      <View
        style={{
          marginTop: 22,
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.goldSoft,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <TrophyIcon iconKey={data.icon} earned size={46} />
      </View>

      {data.familyName ? (
        <Text style={{ marginTop: 18, fontFamily: "GeistMono_400Regular", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.fog }}>
          {data.familyName}
        </Text>
      ) : null}
      <Text style={{ marginTop: data.familyName ? 4 : 18, fontFamily: "Geist_700Bold", fontSize: 22, textAlign: "center", color: colors.white }}>
        {data.name}
      </Text>

      <View style={{ marginTop: 16, alignSelf: "stretch", height: 1, backgroundColor: colors.graphite }} />

      <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch" }}>
        <View>
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: colors.fog }}>Earned</Text>
          <Text style={{ marginTop: 3, fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>{date ?? "Today"}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: colors.fog }}>Rarity</Text>
          <Text style={{ marginTop: 3, fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.gold }}>{formatRarity(data.rarityPct)}</Text>
        </View>
      </View>
    </View>
  );
}
