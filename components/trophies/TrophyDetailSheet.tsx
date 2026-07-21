import { Check, Lock, Share2, Video, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import { TrophyTierLadder } from "@/components/trophies/TrophyTierLadder";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { formatRarity, PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { type LadderRow, type TrophyCardModel } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";

/**
 * Trophy detail bottom sheet (plain RN Modal so it renders on native + web).
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
  onShare
}: {
  card: TrophyCardModel | null;
  ladder: LadderRow[];
  visible: boolean;
  onClose: () => void;
  onShare?: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!card) return null;
  const { def } = card;
  const isStacked = def.type === "stacked";
  const isVideo = def.trackingType === "videoVerification";
  const premium = card.rarityPct < PREMIUM_RARITY_THRESHOLD;
  const earnedDate = formatEarnedDate(card.earnedAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: premium ? colors.gold : colors.iron,
            maxHeight: "82%",
            paddingBottom: insets.bottom + 14
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate }} />
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10} style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}>
            <X size={18} color={colors.fog} strokeWidth={2.4} />
          </Pressable>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 14 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: card.earned ? colors.goldSoft : colors.charcoal,
                borderWidth: card.earned ? 0 : 1,
                borderColor: colors.iron
              }}
            >
              <TrophyIcon iconKey={def.icon} earned={card.earned} size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 19, color: colors.white }}>{def.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: premium ? colors.gold : colors.silver }}>
                  {formatRarity(card.rarityPct)}
                </Text>
                {isStacked ? (
                  <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.fog }}>{card.tierPosition} tiers</Text>
                ) : null}
                {premium ? (
                  <View style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.gold }}>
                    <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, letterSpacing: 0.5, color: colors.gold }}>PREMIUM</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={{ paddingHorizontal: 20, paddingTop: 10, fontFamily: "Geist_400Regular", fontSize: 13, lineHeight: 19, color: colors.silver }}>
            {def.description}
          </Text>

          {isVideo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
              <Video size={14} color={colors.silver} strokeWidth={2} />
              <Text style={{ flex: 1, fontFamily: "Geist_400Regular", fontSize: 12, color: colors.silver }}>
                Tiers unlock when a max-lift video is verified.
              </Text>
            </View>
          ) : null}

          <ScrollView contentContainerStyle={{ paddingTop: 10 }}>
            {isStacked ? (
              <TrophyTierLadder def={def} rows={ladder} progress={card.progress} />
            ) : (
              <StandaloneBody card={card} earnedDate={earnedDate} />
            )}
          </ScrollView>

          {card.earned && onShare ? (
            <Pressable
              onPress={onShare}
              accessibilityLabel="Share trophy"
              style={{
                marginTop: 12,
                marginHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: colors.white
              }}
            >
              <Share2 size={16} color={colors.black} strokeWidth={2.4} />
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.black }}>Share</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function StandaloneBody({ card, earnedDate }: { card: TrophyCardModel; earnedDate: string | null }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 6, gap: 14 }}>
      <View>
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog }}>
          How to earn it
        </Text>
        <Text style={{ marginTop: 6, fontFamily: "Geist_400Regular", fontSize: 14, lineHeight: 20, color: colors.silver }}>
          {card.def.requirement}
        </Text>
      </View>

      {card.progress ? (
        <TrophyProgressBar current={card.progress.current} target={card.progress.target} unit={card.progress.unit} earned={card.earned} />
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
        {card.earned ? (
          <>
            <Check size={15} color={colors.gold} strokeWidth={2.6} />
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }}>
              Earned{earnedDate ? ` · ${earnedDate}` : ""}
            </Text>
          </>
        ) : (
          <>
            <Lock size={13} color={colors.ash} strokeWidth={2} />
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.silver }}>Not earned yet</Text>
          </>
        )}
      </View>
    </View>
  );
}
