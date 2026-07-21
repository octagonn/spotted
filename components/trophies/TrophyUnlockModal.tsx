import { Share2, X } from "lucide-react-native";
import { Modal, Pressable, Share, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { logger } from "@/lib/logger";
import { tierPrimary, type EvaluatedTrophy, type StackedTrophyDef } from "@/lib/trophies";
import { rarityBlurb, rarityColor, type Rarity } from "@/lib/trophyRarity";
import { colors } from "@/theme/colors";

/**
 * Celebration popup shown the moment a trophy (or a new tier) is earned. Same
 * language as StreakPopup — dimmed backdrop, spring scale-in, X to close — plus
 * a Share action. Share is plain text for now (a deep link can slot in later).
 */
export function TrophyUnlockModal({
  visible,
  trophy,
  rarity,
  onClose
}: {
  visible: boolean;
  trophy: EvaluatedTrophy | null;
  rarity?: Rarity;
  onClose: () => void;
}) {
  if (!trophy) return null;
  const { def } = trophy;
  const tierLine =
    def.kind === "stacked" && trophy.highestTier ? tierPrimary(def as StackedTrophyDef, trophy.highestTier) : null;

  const share = async () => {
    const bits = [`I just earned "${def.name}"${tierLine ? ` — ${tierLine}` : ""} on Spotted 🏆`];
    if (rarity) bits.push(`Only ${rarityBlurb(rarity.pct)} have it (${rarity.label}).`);
    try {
      await Share.share({ message: bits.join(" ") });
    } catch (error) {
      logger.warn("trophy_share_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.66)" }}
        />
        <Animated.View entering={ZoomIn.springify().damping(15).mass(0.7)} exiting={FadeOut.duration(120)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: 300,
              paddingVertical: 30,
              paddingHorizontal: 24,
              borderRadius: 24,
              backgroundColor: colors.graphite,
              borderWidth: 1,
              borderColor: colors.iron,
              alignItems: "center"
            }}
          >
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10} style={{ position: "absolute", top: 12, right: 12 }}>
              <X size={18} color={colors.fog} strokeWidth={2.4} />
            </Pressable>

            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: colors.gold }}>
              Trophy unlocked
            </Text>

            <View
              style={{
                marginTop: 16,
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors.goldSoft,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <TrophyIcon iconKey={def.iconKey} earned size={40} />
            </View>

            <Text style={{ marginTop: 18, fontFamily: "Geist_700Bold", fontSize: 19, textAlign: "center", color: colors.white }}>
              {def.name}
            </Text>
            {tierLine ? (
              <Text style={{ marginTop: 3, fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.gold }}>{tierLine}</Text>
            ) : null}
            {rarity ? (
              <Text style={{ marginTop: 6, fontFamily: "GeistMono_400Regular", fontSize: 11, color: rarityColor(rarity.label) }}>
                {rarity.label} · {rarityBlurb(rarity.pct)}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void share()}
              accessibilityLabel="Share trophy"
              style={{
                marginTop: 22,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                alignSelf: "stretch",
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: colors.white
              }}
            >
              <Share2 size={16} color={colors.black} strokeWidth={2.4} />
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.black }}>Share</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
