import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bell, Camera, Lock } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

export type LockPoster = { id: string; name: string; avatarUrl: string | null };

/** First-name social-proof line: "Marcus, Tori and 3 others went today." */
function posterLine(posters: LockPoster[], total: number): string {
  if (total <= 0) return "Be the first of your crew today.";
  const names = posters.slice(0, 2).map((p) => p.name.split(" ")[0]);
  const rest = total - names.length;
  if (names.length === 1 && rest <= 0) return `${names[0]} already went today.`;
  if (rest <= 0) return `${names.join(" and ")} went today.`;
  return `${names.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"} went today.`;
}

/**
 * Locked-feed gate (feed-lock spec A), overhauled. A frosted blur sits over the
 * silhouette cards while capturing every touch. The pitch is social: an avatar
 * stack of friends who already posted + a count of drops waiting behind the
 * glass, under an animated gold CTA. Fades out on unlock (the blur dissolve).
 */
export function LockOverlay({
  friendsPostedToday = 0,
  posters = [],
  lockedCount = 0
}: {
  friendsPostedToday?: number;
  posters?: LockPoster[];
  lockedCount?: number;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Gentle breathing pulse on the CTA so it draws the eye.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [reduced, pulse]);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const shown = posters.slice(0, 4);

  return (
    <Animated.View
      exiting={FadeOut.duration(600)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Frosted glass over the silhouettes — content unreadable, mood intact. */}
      <BlurView intensity={38} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient
        colors={["rgba(6,6,7,0.72)", "rgba(6,6,7,0.5)", "rgba(6,6,7,0.85)"]}
        locations={[0, 0.4, 1]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Taunts + notifications stay reachable while locked (spec A). */}
      <Pressable
        onPress={() => router.push("/inbox")}
        accessibilityLabel="Notifications"
        hitSlop={10}
        style={{ position: "absolute", top: insets.top + 8, right: 18, width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}
      >
        <Bell size={24} color={colors.white} strokeWidth={2} />
      </Pressable>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 34, paddingBottom: 40 }}>
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(420).springify().damping(16)} style={{ alignItems: "center" }}>
          {/* Gold-ringed emblem with a soft glow. */}
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              borderWidth: 1.5,
              borderColor: tokens.accent.gold,
              backgroundColor: tokens.accent.goldSubtle,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: tokens.accent.gold,
              shadowOpacity: 0.5,
              shadowRadius: 22,
              elevation: 10
            }}
          >
            <Lock size={28} color={tokens.accent.gold} strokeWidth={2} />
          </View>

          <Text
            allowFontScaling={false}
            style={{
              fontFamily: "Boldonse_400Regular",
              fontSize: 21,
              lineHeight: 21 * 1.4 + 8,
              color: colors.white,
              textAlign: "center",
              marginTop: 20,
              includeFontPadding: false
            }}
          >
            Post to unlock.
          </Text>

          {/* Social proof — avatar stack + first-name line. FOMO is the point. */}
          {friendsPostedToday > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
              <View style={{ flexDirection: "row" }}>
                {shown.map((p, i) => (
                  <View
                    key={p.id}
                    style={{
                      marginLeft: i === 0 ? 0 : -10,
                      borderWidth: 2,
                      borderColor: colors.black,
                      borderRadius: 16
                    }}
                  >
                    <Avatar name={p.name} uri={p.avatarUrl} size={28} />
                  </View>
                ))}
              </View>
              <Text style={{ flexShrink: 1, fontFamily: "Geist_500Medium", fontSize: 13, lineHeight: 18, color: colors.silver }}>
                {posterLine(posters, friendsPostedToday)}
              </Text>
            </View>
          ) : (
            <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: colors.silver, textAlign: "center", maxWidth: 260 }}>
              Post a photo from your session to see everyone else&apos;s.
            </Text>
          )}

          {/* Drops-waiting teaser. */}
          {lockedCount > 0 ? (
            <Text style={{ marginTop: 10, fontFamily: "GeistMono_500Medium", fontSize: 11, letterSpacing: 0.5, color: colors.fog }}>
              {`${lockedCount} ${lockedCount === 1 ? "drop" : "drops"} waiting behind the glass`}
            </Text>
          ) : null}

          {/* Animated gold CTA. */}
          <Animated.View style={[{ marginTop: 26, alignSelf: "stretch" }, ctaStyle]}>
            <Pressable onPress={() => router.push("/camera?mode=daily")} accessibilityLabel="Post today's SPOTTED">
              <LinearGradient
                colors={["#F2C25A", tokens.accent.gold, "#D89A2E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  borderRadius: 999,
                  paddingVertical: 16,
                  paddingHorizontal: 30
                }}
              >
                <Camera size={18} color={colors.black} strokeWidth={2.4} />
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.black }}>
                  Post today&apos;s SPOTTED
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Text style={{ marginTop: 12, fontSize: 11.5, color: colors.fog, textAlign: "center" }}>
            Resets at midnight. One drop unlocks the feed.
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
