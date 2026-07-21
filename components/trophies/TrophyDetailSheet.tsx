import { Check, Lock, Share2, Video, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrophyIcon } from "@/components/trophies/TrophyIcon";
import { TrophyProgressBar } from "@/components/trophies/TrophyProgressBar";
import {
  tierPrimary,
  tierSecondary,
  type EvaluatedTrophy,
  type StackedTrophyDef,
  type StandaloneTrophyDef
} from "@/lib/trophies";
import { rarityBlurb, rarityColor, type Rarity } from "@/lib/trophyRarity";
import { colors } from "@/theme/colors";

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Trophy detail bottom sheet — a plain RN Modal so it renders on native AND web
 * (the old gorhom sheet didn't). Handles both shapes:
 *  - stacked:    the full tier ladder (earned gold + date, next shows progress).
 *  - standalone: the requirement, earned state, or live progress (Nomad x/24).
 * Rarity is shown for both. Strength trophies note the video-verify requirement.
 */
export function TrophyDetailSheet({
  trophy,
  rarity,
  visible,
  onClose,
  onShare
}: {
  trophy: EvaluatedTrophy | null;
  rarity?: Rarity;
  visible: boolean;
  onClose: () => void;
  /** Shown as a Share button when the trophy is earned. */
  onShare?: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!trophy) return null;
  const { def } = trophy;
  const isStacked = def.kind === "stacked";
  const isVideo = isStacked && (def as StackedTrophyDef).verify === "video";

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
            borderColor: colors.iron,
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
                backgroundColor: trophy.earned ? colors.goldSoft : colors.charcoal,
                borderWidth: trophy.earned ? 0 : 1,
                borderColor: colors.iron
              }}
            >
              <TrophyIcon iconKey={def.iconKey} earned={trophy.earned} size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 19, color: colors.white }}>{def.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 }}>
                {rarity ? (
                  <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: rarityColor(rarity.label) }}>
                    {rarity.label} · {rarityBlurb(rarity.pct)}
                  </Text>
                ) : null}
                {isStacked ? (
                  <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.fog }}>
                    {trophy.earnedCount}/{trophy.total} tiers
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {isVideo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
              <Video size={14} color={colors.silver} strokeWidth={2} />
              <Text style={{ flex: 1, fontFamily: "Geist_400Regular", fontSize: 12, color: colors.silver }}>
                Tiers unlock when a max-lift video is verified.
              </Text>
            </View>
          ) : null}

          <ScrollView contentContainerStyle={{ paddingTop: 8 }}>
            {isStacked ? (
              <StackedLadder trophy={trophy} />
            ) : (
              <StandaloneBody trophy={trophy} def={def as StandaloneTrophyDef} />
            )}
          </ScrollView>

          {trophy.earned && onShare ? (
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

function StackedLadder({ trophy }: { trophy: EvaluatedTrophy }) {
  const def = trophy.def as StackedTrophyDef;
  const tiers = trophy.tiers ?? [];
  const trackable = def.trackable === true;
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {tiers.map((t) => {
        const primary = tierPrimary(def, t.tier);
        const secondary = tierSecondary(def, t.tier);
        const date = formatDate(t.date);
        return (
          <View
            key={t.tier.threshold}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.graphite }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.earned ? colors.gold : "transparent",
                borderWidth: t.earned ? 0 : 1.5,
                borderColor: t.isNext ? colors.gold : colors.iron
              }}
            >
              {t.earned ? (
                <Check size={14} color={colors.black} strokeWidth={3} />
              ) : t.isNext ? (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold }} />
              ) : (
                <Lock size={11} color={colors.ash} strokeWidth={2} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: t.earned ? colors.white : t.isNext ? colors.bone : colors.silver }}>
                {primary}
              </Text>
              {secondary ? (
                <Text style={{ marginTop: 1, fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>{secondary}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", minWidth: 64 }}>
              {t.earned ? (
                <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.gold }}>{date ?? "Earned"}</Text>
              ) : t.isNext && trackable && trophy.progress ? (
                <View style={{ width: 64 }}>
                  <TrophyProgressBar current={trophy.progress.current} target={t.tier.threshold} unit={def.unit} showLabel />
                </View>
              ) : (
                <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.ash }}>Locked</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StandaloneBody({ trophy, def }: { trophy: EvaluatedTrophy; def: StandaloneTrophyDef }) {
  const date = formatDate(trophy.earnedDate);
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 14 }}>
      <View>
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog }}>
          How to earn it
        </Text>
        <Text style={{ marginTop: 6, fontFamily: "Geist_400Regular", fontSize: 14, lineHeight: 20, color: colors.silver }}>
          {def.requirement}
        </Text>
      </View>

      {def.progress && trophy.progress ? (
        <TrophyProgressBar current={trophy.progress.current} target={trophy.progress.target} unit={trophy.progress.unit} earned={trophy.earned} />
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
        {trophy.earned ? (
          <>
            <Check size={15} color={colors.gold} strokeWidth={2.6} />
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }}>Earned{date ? ` · ${date}` : ""}</Text>
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
