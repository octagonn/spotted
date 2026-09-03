import { Image } from "expo-image";
import { Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text as RNText, View } from "react-native";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { TrophyRarity } from "@/components/trophies/TrophyRarity";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { type TrophyMedal } from "@/lib/trophies";
import { medalColors, resolveMedal } from "@/lib/trophyMedal";
import { medalArt, medalGlyphColor } from "@/lib/trophyMedalArt";
import { formatRarity } from "@/lib/trophyRaritySeeds";
import { type EarnedEntry, type TrophyCardModel } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/**
 * Round icon disc. Always shows the trophy's medallion in its rarity metal
 * (explicit tier, else rarity-derived — see resolveMedal) with the family
 * glyph composited over the empty center face. Locked trophies keep the full
 * rarity color but sit under a dark scrim with a small padlock badge.
 */
export function TrophyIconDisc({
  iconKey,
  earned,
  size = 46,
  tint,
  medal
}: {
  iconKey: string;
  earned: boolean;
  size?: number;
  /** Soft fill behind the medallion; defaults to the medal's soft color. */
  tint?: string;
  /** Resolved display medal (callers use resolveMedal). */
  medal: TrophyMedal;
}) {
  const lockBadge = Math.round(size * 0.4);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tint ?? medalColors(medal).soft
      }}
    >
      <Image
        source={medalArt(medal)}
        style={{ position: "absolute", width: size - 2, height: size - 2 }}
        contentFit="contain"
        accessible={false}
      />
      <TrophyIcon iconKey={iconKey} earned size={Math.round(size * 0.34)} color={medalGlyphColor(medal)} />
      {!earned ? (
        <>
          {/* Dark scrim: rarity color stays visible but clearly dormant. */}
          <View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: "rgba(0,0,0,0.44)"
            }}
          />
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: lockBadge,
              height: lockBadge,
              borderRadius: lockBadge / 2,
              backgroundColor: tokens.bg.raised,
              borderWidth: 1,
              borderColor: tokens.border.default,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Lock size={Math.round(lockBadge * 0.52)} color={colors.silver} strokeWidth={2.4} />
          </View>
        </>
      ) : null}
    </View>
  );
}

/** The one card frame both tabs use: raised, centered, fixed width. */
function CardShell({
  width,
  minHeight,
  onPress,
  accessibilityLabel,
  children
}: {
  width: number;
  minHeight: number;
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} haptic="none">
      <View
        style={{
          width,
          minHeight,
          paddingVertical: space[4] - 1,
          paddingHorizontal: space[3],
          borderRadius: radius.md,
          backgroundColor: tokens.bg.raised,
          alignItems: "center",
          gap: space[1] + 2
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

function CardName({ children, dim = false }: { children: string; dim?: boolean }) {
  return (
    <Text variant="label" numberOfLines={2} className={`text-center ${dim ? "text-silver" : "text-white"}`}>
      {children}
    </Text>
  );
}

/**
 * Categories-tab card. Stacked families show the highest earned tier (or the
 * first locked one with its requirement) plus tier dots; standalones show name,
 * earned/requirement and rarity. A progress bar appears only for auto-tracked
 * families — never for video-verified strength.
 */
export function TrophyCard({ card, width, onPress }: { card: TrophyCardModel; width: number; onPress: () => void }) {
  const earned = card.earned;
  const stacked = card.def.type === "stacked";
  const displayMedal = resolveMedal(stacked ? card.displayTier?.medal : card.def.medal, card.rarityPct);
  const medal = medalColors(displayMedal);
  return (
    <CardShell width={width} minHeight={158} onPress={onPress} accessibilityLabel={card.def.name}>
      <TrophyIconDisc iconKey={card.def.icon} earned={earned} medal={displayMedal} />

      {stacked ? (
        <Text variant="micro" numberOfLines={1}>
          {card.def.name}
        </Text>
      ) : null}
      <CardName dim={!earned}>{stacked ? card.displayName : card.def.name}</CardName>

      {earned ? (
        <EarnedLine color={medal.text} />
      ) : card.requirement ? (
        <Text variant="mono" numberOfLines={stacked ? 1 : 2} className="text-center">
          {card.requirement}
        </Text>
      ) : null}

      {card.progress ? (
        <View style={{ width: "100%", paddingHorizontal: 2 }}>
          <TrophyProgressBar
            current={card.progress.current}
            target={card.progress.target}
            unit={card.progress.unit}
            earned={earned}
            toward={card.progress.toward}
          />
        </View>
      ) : null}

      {stacked ? (
        <View style={{ alignItems: "center", gap: space[1] }}>
          <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
            {Array.from({ length: card.totalTiers }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i < card.earnedTierCount ? tokens.accent.gold : tokens.border.default
                }}
              />
            ))}
          </View>
          <Text variant="mono">{card.tierPosition}</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <TrophyRarity pct={card.rarityPct} />
    </CardShell>
  );
}

/**
 * Earned-tab card. Every earned tier/standalone is its own entry: gold icon,
 * name (tier name for stacked), the family name when it's a tier, "Earned", the
 * exact achievement date, and the rarity percentage — all always visible.
 */
export function EarnedTrophyCard({
  entry,
  width,
  onPress
}: {
  entry: EarnedEntry;
  width: number;
  onPress: () => void;
}) {
  const date = formatEarnedDate(entry.earnedAt);
  return (
    <CardShell
      width={width}
      minHeight={168}
      onPress={onPress}
      accessibilityLabel={`${entry.displayName}, ${formatRarity(entry.rarityPct)}`}
    >
      <TrophyIconDisc
        iconKey={entry.icon}
        earned
        medal={resolveMedal(entry.tier ? entry.tier.medal : entry.def.medal, entry.rarityPct)}
      />
      {entry.familyName ? (
        <Text variant="micro" numberOfLines={1}>
          {entry.familyName}
        </Text>
      ) : null}
      <CardName>{entry.displayName}</CardName>
      <EarnedLine />
      {date ? (
        <Text variant="mono" numberOfLines={1} className="text-silver">
          {date}
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      <TrophyRarity pct={entry.rarityPct} />
    </CardShell>
  );
}

/** "Earned" in the medal color. Medal tints are data-driven hex, so the tinted case is a raw Text. */
function EarnedLine({ color }: { color?: string }) {
  if (color && color !== tokens.accent.gold) {
    return (
      <RNText
        maxFontSizeMultiplier={2}
        style={{ fontFamily: "Geist_500Medium", fontSize: 11, lineHeight: 15, letterSpacing: 0.6, color }}
      >
        Earned
      </RNText>
    );
  }
  return (
    <Text variant="micro" className="normal-case text-gold">
      Earned
    </Text>
  );
}
