import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Share2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable as RNPressable, Share, Text as RNText, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";

import { DiamondGlint } from "@/components/trophies/DiamondGlint";
import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyShareCard, type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { formatEarnedDate } from "@/components/trophies/trophyFormat";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Text } from "@/components/ui/Text";
import { Confetti } from "@/components/workout/Confetti";
import { haptic } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { medalColors, medalLabel, resolveMedal } from "@/lib/trophyMedal";
import { medalArt, medalGlyphColor } from "@/lib/trophyMedalArt";
import { formatRarity, PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";
import { durations } from "@/theme/motion";
import { icon, radius, space, tokens } from "@/theme/tokens";

const CARD_W = 308;

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
      haptic("success");
    }
  }, [visible]);

  if (!data) return null;
  const premium = data.rarityPct < PREMIUM_RARITY_THRESHOLD;
  const date = formatEarnedDate(data.earnedAt);
  const displayMedal = resolveMedal(data.medal, data.rarityPct);
  const medal = medalColors(displayMedal);

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
    const message = `I earned "${data.name}" on Spotted — ${formatRarity(data.rarityPct)} have it.`;
    try {
      if (imageUri && Platform.OS !== "web") {
        await Share.share({ url: imageUri, message });
      } else {
        await Share.share({ message });
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

      <RNPressable onPress={onClose} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          entering={FadeIn.duration(durations.press)}
          exiting={FadeOut.duration(durations.press)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.bg.scrim }}
        />
        {/* Gold burst behind everything — this is a moment. */}
        <Confetti seed={confettiKey} />
        <Animated.View entering={ZoomIn.springify().damping(13).mass(0.7)} exiting={FadeOut.duration(durations.press)}>
          <RNPressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: CARD_W,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: tokens.bg.raised,
              borderWidth: 1,
              borderColor: premium || displayMedal === "diamond" ? medal.solid : medal.border
            }}
          >
            {/* Tier-colored wash from the top — reads as a celebration, not a dialog. */}
            <LinearGradient
              colors={[medal.soft, "rgba(0,0,0,0)"]}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150 }}
            />
            {displayMedal === "diamond" ? <DiamondGlint width={CARD_W} height={360} /> : null}
            <View style={{ paddingVertical: space[8] - 2, paddingHorizontal: space[6], alignItems: "center" }}>
              <View style={{ position: "absolute", top: space[1], right: space[1], zIndex: 2 }}>
                <IconButton
                  variant="plain"
                  icon={<X size={icon.size.sm} color={tokens.text.tertiary} strokeWidth={icon.stroke.bold} />}
                  accessibilityLabel="Close"
                  onPress={onClose}
                />
              </View>

              {/* Medal color is data-driven — the one raw Text here. */}
              <RNText
                maxFontSizeMultiplier={1.4}
                style={{
                  fontFamily: "GeistMono_400Regular",
                  fontSize: 10.5,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: medal.text
                }}
              >
                {data.medal ? `${medalLabel(data.medal)} unlocked` : "Trophy Unlocked"}
              </RNText>

              <Animated.View
                entering={ZoomIn.springify().damping(9).stiffness(180).delay(120)}
                style={{
                  marginTop: space[4] + 2,
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.goldSoft,
                  borderWidth: 2,
                  borderColor: tokens.accent.gold,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: tokens.accent.gold,
                  shadowOpacity: 0.6,
                  shadowRadius: 22,
                  elevation: 10
                }}
              >
                <Image
                  source={medalArt(displayMedal)}
                  style={{ position: "absolute", width: 90, height: 90 }}
                  contentFit="contain"
                  accessible={false}
                />
                <TrophyIcon iconKey={data.icon} earned size={33} color={medalGlyphColor(displayMedal)} />
              </Animated.View>

              {data.familyName ? (
                <Text variant="micro" className="mt-[14px]">
                  {data.familyName}
                </Text>
              ) : null}
              <Text variant="heading" className={`text-center ${data.familyName ? "mt-[3px]" : "mt-[18px]"}`}>
                {data.name}
              </Text>
              <Text variant="mono" className={`mt-[6px] ${premium ? "text-gold" : "text-silver"}`}>
                {formatRarity(data.rarityPct)}
              </Text>
              {date ? (
                <Text variant="mono" className="mt-[3px]">
                  {`Earned ${date}`}
                </Text>
              ) : null}

              <View style={{ marginTop: space[6] - 2, alignSelf: "stretch" }}>
                <Button
                  onPress={() => void share()}
                  icon={<Share2 size={icon.size.xs} color={colors.black} strokeWidth={icon.stroke.bold} />}
                  accessibilityLabel="Share trophy"
                >
                  Share
                </Button>
              </View>
            </View>
          </RNPressable>
        </Animated.View>
      </RNPressable>
    </Modal>
  );
}
