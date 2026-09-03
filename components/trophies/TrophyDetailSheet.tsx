import { Check, Lock, Pin, Share2, X } from "lucide-react-native";
import { Modal, Pressable as RNPressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrophyIconDisc } from "@/components/trophies/TrophyCard";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { TrophyTierLadder } from "@/components/trophies/TrophyTierLadder";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { resolveMedal } from "@/lib/trophyMedal";
import { formatRarity, PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { type LadderRow, type TrophyCardModel } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/**
 * Trophy detail bottom sheet (plain RN Modal so it renders on native + web,
 * and above the trophy case's own sheet host).
 *  - stacked:    the full tier ladder, each row with its rarity + earned date.
 *  - standalone: requirement, earned state + exact date, rarity.
 * Rarity is always the numeric "X% of users". Sub-1% trophies get a subtle gold
 * "Premium" chip, but the number is still the primary display.
 */
export function TrophyDetailSheet({
  card,
  ladder,
  visible,
  onClose,
  onShare,
  onFeature,
  featured
}: {
  card: TrophyCardModel | null;
  ladder: LadderRow[];
  visible: boolean;
  onClose: () => void;
  onShare?: () => void;
  onFeature?: () => void;
  featured?: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (!card) return null;
  const { def } = card;
  const isStacked = def.type === "stacked";
  const premium = card.rarityPct < PREMIUM_RARITY_THRESHOLD;
  const earnedDate = formatEarnedDate(card.earnedAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: tokens.bg.scrim }}>
        <RNPressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: premium ? 1 : 0,
            borderBottomWidth: 0,
            borderColor: tokens.accent.gold,
            maxHeight: "82%",
            paddingBottom: insets.bottom + space[3] + 2
          }}
        >
          <View style={{ alignItems: "center", paddingTop: space[2] + 2 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate }} />
          </View>
          <View style={{ position: "absolute", top: space[2], right: space[2], zIndex: 2 }}>
            <IconButton
              variant="plain"
              icon={<X size={icon.size.sm} color={tokens.text.tertiary} strokeWidth={icon.stroke.bold} />}
              accessibilityLabel="Close"
              onPress={onClose}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space[3] + 2,
              paddingHorizontal: space[4] + 4,
              paddingTop: space[3] + 2,
              paddingRight: space[12]
            }}
          >
            <TrophyIconDisc
              iconKey={def.icon}
              earned={card.earned}
              size={54}
              medal={resolveMedal(isStacked ? card.displayTier?.medal : def.medal, card.rarityPct)}
            />
            <View style={{ flex: 1 }}>
              <Text variant="heading">{def.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: 3 }}>
                <Text variant="mono" className={premium ? "text-gold" : "text-silver"}>
                  {formatRarity(card.rarityPct)}
                </Text>
                {isStacked ? <Text variant="mono">{`${card.tierPosition} tiers`}</Text> : null}
                {premium ? (
                  <View
                    style={{
                      paddingVertical: 2,
                      paddingHorizontal: 7,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: tokens.accent.gold
                    }}
                  >
                    <Text variant="micro" className="text-gold">
                      Premium
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <Text variant="caption" className="px-5 pt-[10px]">
            {def.description}
          </Text>

          <ScrollView contentContainerStyle={{ paddingTop: space[2] + 2 }}>
            {isStacked ? (
              <TrophyTierLadder def={def} rows={ladder} progress={card.progress} />
            ) : (
              <StandaloneBody card={card} earnedDate={earnedDate} />
            )}
          </ScrollView>

          {card.earned && onShare ? (
            <View style={{ marginTop: space[3], marginHorizontal: space[4] + 4, gap: space[2] }}>
              <Button
                onPress={onShare}
                icon={<Share2 size={icon.size.xs} color={colors.black} strokeWidth={icon.stroke.bold} />}
                accessibilityLabel="Share trophy"
              >
                Share
              </Button>
              {onFeature ? (
                <Button
                  variant="ghost"
                  onPress={onFeature}
                  icon={
                    <Pin
                      size={icon.size.xs - 1}
                      color={featured ? tokens.accent.gold : colors.mist}
                      strokeWidth={icon.stroke.regular}
                    />
                  }
                  accessibilityLabel={featured ? "Unpin from profile" : "Pin to profile"}
                  style={featured ? { borderColor: tokens.accent.gold } : undefined}
                >
                  {featured ? "Featured on profile" : "Feature on profile"}
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function StandaloneBody({ card, earnedDate }: { card: TrophyCardModel; earnedDate: string | null }) {
  return (
    <View style={{ paddingHorizontal: space[4] + 4, paddingTop: space[1] + 2, gap: space[3] + 2 }}>
      <View>
        <Text variant="micro">How to earn it</Text>
        <Text variant="body-sm" className="mt-[6px] text-silver">
          {card.def.requirement}
        </Text>
      </View>

      {card.progress ? (
        <TrophyProgressBar
          current={card.progress.current}
          target={card.progress.target}
          unit={card.progress.unit}
          earned={card.earned}
        />
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          paddingVertical: space[3],
          paddingHorizontal: space[3] + 2,
          borderRadius: radius.sm,
          backgroundColor: tokens.bg.raised
        }}
      >
        {card.earned ? (
          <>
            <Check size={icon.size.xs - 1} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />
            <Text variant="meta-strong" className="text-white">
              {`Earned${earnedDate ? ` · ${earnedDate}` : ""}`}
            </Text>
          </>
        ) : (
          <>
            <Lock size={13} color={colors.ash} strokeWidth={icon.stroke.regular} />
            <Text variant="meta-strong">Not earned yet</Text>
          </>
        )}
      </View>
    </View>
  );
}
