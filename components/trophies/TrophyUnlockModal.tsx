import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Share2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, Share, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";

import { Confetti } from "@/components/workout/Confetti";
import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyShareCard, type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { logger } from "@/lib/logger";
import { DiamondGlint } from "@/components/trophies/DiamondGlint";
import { medalColors, medalLabel } from "@/lib/trophyMedal";
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
  // Re-fire the confetti burst each time the modal opens.
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    if (visible) {
      setConfettiKey((k) => k + 1);
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
        await Share.share({ url: imageUri, message: `I earned "${data.name}" on Spotted — ${formatRarity(data.rarityPct)} have it.` });
      } else {
        await Share.share({ message: `I earned "${data.name}" on Spotted — ${formatRarity(data.rarityPct)} have it.` });
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
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.74)" }}
        />
        {/* Gold burst behind everything — this is a moment. */}
        <Confetti seed={confettiKey} />
        <Animated.View entering={ZoomIn.springify().damping(13).mass(0.7)} exiting={FadeOut.duration(120)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: 308,
              borderRadius: 24,
              overflow: "hidden",
              backgroundColor: colors.graphite,
              borderWidth: 1,
              borderColor: premium || data?.medal === "diamond" ? medalColors(data?.medal).solid : medalColors(data?.medal).border
            }}
          >
            {/* Tier-colored wash from the top — reads as a celebration, not a dialog. */}
            <LinearGradient
              colors={[medalColors(data?.medal).soft, "rgba(0,0,0,0)"]}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150 }}
            />
            {data?.medal === "diamond" ? <DiamondGlint width={308} height={360} /> : null}
            <View style={{ paddingVertical: 30, paddingHorizontal: 24, alignItems: "center" }}>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10} style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
              <X size={18} color={colors.fog} strokeWidth={2.4} />
            </Pressable>

            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 3, textTransform: "uppercase", color: medalColors(data?.medal).text }}>
              {data?.medal ? `${medalLabel(data.medal)} unlocked` : "Trophy Unlocked"}
            </Text>

            <Animated.View
              entering={ZoomIn.springify().damping(9).stiffness(180).delay(120)}
              style={{
                marginTop: 18,
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.goldSoft,
                borderWidth: 2,
                borderColor: colors.gold,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.gold,
                shadowOpacity: 0.6,
                shadowRadius: 22,
                elevation: 10
              }}
            >
              <TrophyIcon iconKey={data.icon} earned size={46} />
            </Animated.View>

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
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
