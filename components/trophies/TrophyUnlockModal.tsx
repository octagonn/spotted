import * as Haptics from "expo-haptics";
import { Share2, X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Modal, Platform, Pressable, Share, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyShareCard, type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { logger } from "@/lib/logger";
import { formatRarity, PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";

/**
 * Celebration modal shown the moment a trophy or tier is earned. Same pattern as
 * StreakPopup — dimmed backdrop, spring scale-in, haptic — with the numeric
 * rarity, exact date, a Share button (renders + captures a TrophyShareCard), and
 * an X. Gold communicates earned status without flooding the modal.
 */
export function TrophyUnlockModal({
  data,
  visible,
  onClose
}: {
  data: TrophyShareData | null;
  visible: boolean;
  onClose: () => void;
}) {
  const shareRef = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [visible]);

  if (!data) return null;
  const premium = data.rarityPct < PREMIUM_RARITY_THRESHOLD;
  const date = formatEarnedDate(data.earnedAt);

  const share = async () => {
    // Capture the branded share card to an image; fall back to text.
    let imageUri: string | null = null;
    try {
      imageUri = await Promise.race([
        captureRef(shareRef, { format: "png", quality: 1 }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500))
      ]);
    } catch {
      imageUri = null;
    }
    try {
      if (imageUri && Platform.OS !== "web") {
        await Share.share({ url: imageUri, message: `I earned "${data.name}" on Spotted 🏆 — ${formatRarity(data.rarityPct)} have it.` });
      } else {
        await Share.share({ message: `I earned "${data.name}" on Spotted 🏆 — ${formatRarity(data.rarityPct)} have it.` });
      }
    } catch (error) {
      logger.warn("trophy_share_failed", { message: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Off-screen share card for capture. */}
      <View style={{ position: "absolute", top: -10000, left: 0 }} pointerEvents="none">
        <View ref={shareRef} collapsable={false}>
          <TrophyShareCard data={data} />
        </View>
      </View>

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
              borderColor: premium ? colors.gold : colors.iron,
              alignItems: "center"
            }}
          >
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10} style={{ position: "absolute", top: 12, right: 12 }}>
              <X size={18} color={colors.fog} strokeWidth={2.4} />
            </Pressable>

            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: colors.gold }}>
              Trophy Unlocked
            </Text>

            <View style={{ marginTop: 16, width: 84, height: 84, borderRadius: 42, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" }}>
              <TrophyIcon iconKey={data.icon} earned size={40} />
            </View>

            {data.familyName ? (
              <Text style={{ marginTop: 14, fontFamily: "GeistMono_400Regular", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.fog }}>
                {data.familyName}
              </Text>
            ) : null}
            <Text style={{ marginTop: data.familyName ? 3 : 18, fontFamily: "Geist_700Bold", fontSize: 19, textAlign: "center", color: colors.white }}>
              {data.name}
            </Text>
            <Text style={{ marginTop: 6, fontFamily: "GeistMono_400Regular", fontSize: 11, color: premium ? colors.gold : colors.silver }}>
              {formatRarity(data.rarityPct)}
            </Text>
            {date ? (
              <Text style={{ marginTop: 3, fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.fog }}>Earned {date}</Text>
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
