import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bell, Camera, Dumbbell, Lock, Moon } from "lucide-react-native";
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
import { useActivityUnreadCount } from "@/hooks/queries/useNotifications";
import { restDayMessage, useMarkRestDay } from "@/hooks/queries/useRestDay";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useAuthStore } from "@/stores/auth";
import { localDateKey, showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";
import { trackAnalyticsEvent } from "@/lib/analytics";

export type LockPoster = { id: string; name: string; avatarUrl: string | null };

// The slide-in entrance should play once per locked day, not every time the
// overlay happens to mount again (feed refetches / re-renders replayed it).
let enteredForDay: string | null = null;

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
  const markRestDay = useMarkRestDay();
  // Today's ledger state — logging a rest day used to leave this overlay
  // completely unchanged (same "Post to unlock" pitch, same rest button), so
  // it read as if the tap did nothing. Same cache the profile calendar uses.
  const userId = useAuthStore((state) => state.userId);
  const streakDays = useStreakDays(userId);
  // Unseen notifications → red dot on the bell (the feed header's badge is
  // hidden behind this overlay while locked).
  const unreadCount = useActivityUnreadCount();
  const restToday = streakDays.data instanceof Map && streakDays.data.get(localDateKey())?.kind === "rest";

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
  const todayKey = localDateKey();
  const playEntrance = !reduced && enteredForDay !== todayKey;
  useEffect(() => {
    enteredForDay = todayKey;
  }, [todayKey]);

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
        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        hitSlop={10}
        style={{ position: "absolute", top: insets.top + 8, right: 18, width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}
      >
        <View>
          <Bell size={24} color={colors.white} strokeWidth={2} />
          {unreadCount > 0 ? (
            <View style={{ position: "absolute", top: -2, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF3B30", borderWidth: 1.5, borderColor: colors.black }} />
          ) : null}
        </View>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 34, paddingBottom: 40 }}>
        <Animated.View entering={playEntrance ? FadeInDown.duration(420).springify().damping(16) : undefined} style={{ alignItems: "center" }}>
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
            {restToday ? (
              <Moon size={28} color={tokens.accent.gold} strokeWidth={2} />
            ) : (
              <Lock size={28} color={tokens.accent.gold} strokeWidth={2} />
            )}
          </View>

          <Text
            maxFontSizeMultiplier={1.4}
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
            {restToday ? "Rest day logged." : "Post to unlock."}
          </Text>

          {restToday ? (
            <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: colors.silver, textAlign: "center", maxWidth: 270 }}>
              Your streak is safe for today. The feed still unlocks with a post — if you end up going, cancel the rest day below.
            </Text>
          ) : null}

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
          ) : restToday ? null : (
            <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: colors.silver, textAlign: "center", maxWidth: 260 }}>
              Post a photo from your session to see everyone else&apos;s.
            </Text>
          )}

          {/* Drops-waiting teaser. */}
          {lockedCount > 0 ? (
            <Text style={{ marginTop: 10, fontFamily: "Geist_500Medium", fontSize: 12, color: colors.fog }}>
              {`${lockedCount} ${lockedCount === 1 ? "drop" : "drops"} waiting behind the glass`}
            </Text>
          ) : null}

          {/* Animated gold CTA. */}
          <Animated.View style={[{ marginTop: 26, alignSelf: "stretch" }, ctaStyle]}>
            <Pressable
              onPress={() => {
                trackAnalyticsEvent("lock_cta_tapped", { action: "post" });
                router.push("/camera?mode=daily");
              }}
              accessibilityLabel="Post today's SPOTTED"
            >
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

          {/* Log a workout first — it rides along with your daily photo as a
              feed slide. */}
          <Pressable
            onPress={() => {
              trackAnalyticsEvent("lock_cta_tapped", { action: "workout" });
              router.push("/workout?daily=1");
            }}
            accessibilityLabel="Start a workout for your daily"
            style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch", paddingVertical: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.slate }}
          >
            <Dumbbell size={16} color={colors.white} strokeWidth={2.2} />
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.white }}>
              Log a workout with it
            </Text>
          </Pressable>

          {/* Rest day: protects the streak without faking a workout. It does
              NOT unlock the feed — seeing friends' drops still costs a drop —
              and it does not add to the streak number, it only stops it
              breaking. today-only and the weekly cap are enforced server-side.
              Once logged, the same slot flips to the change-of-mind path. */}
          <Pressable
            onPress={() => {
              if (markRestDay.isPending) return;
              markRestDay.mutate(!restToday, {
                onSuccess: (result) => showToast(restDayMessage(result)),
                onError: () => showToast("Couldn't update your rest day — try again.")
              });
            }}
            accessibilityLabel={restToday ? "Cancel today's rest day" : "Log today as a rest day"}
            style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch", paddingVertical: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.slate }}
          >
            <Moon size={16} color={colors.white} strokeWidth={2.2} />
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.white }}>
              {markRestDay.isPending ? (restToday ? "Cancelling…" : "Logging…") : restToday ? "Cancel rest day" : "Taking a rest day"}
            </Text>
          </Pressable>

          <Text style={{ marginTop: 12, fontSize: 11.5, color: colors.fog, textAlign: "center" }}>
            Resets at midnight. One drop unlocks the feed.
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
