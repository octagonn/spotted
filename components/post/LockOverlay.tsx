import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bell, Camera, Lock } from "lucide-react-native";
import { Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/**
 * Locked-feed gate (feed-lock spec A). Semi-opaque so the blurred cards
 * underneath read as silhouettes (avatar + gym + timestamp, no content),
 * while capturing ALL touches — nothing is readable or tappable until
 * today's post. Unmounts with a fade when the feed unlocks (the "blur
 * dissolve" reveal). The bell keeps taunts/notifications reachable while
 * locked; the CTA leads straight into the post flow.
 */
export function LockOverlay({ friendsPostedToday = 0 }: { friendsPostedToday?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      exiting={FadeOut.duration(650)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,6,6,0.78)" }}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.62)", "rgba(0,0,0,0.35)"]}
        locations={[0, 0.45, 1]}
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
      <View style={{ alignItems: "center", marginTop: 140 }}>
        <View style={{ maxWidth: 280, alignItems: "center" }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              borderWidth: 1.5,
              borderColor: colors.slate,
              backgroundColor: "rgba(10,10,10,0.85)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Lock size={22} color={colors.white} strokeWidth={2} />
          </View>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: "Boldonse_400Regular",
              fontSize: 17,
              lineHeight: 17 * 1.5 + 8,
              color: colors.white,
              textAlign: "center",
              marginTop: 14,
              includeFontPadding: false
            }}
          >
            Post to unlock.
          </Text>
          <Text style={{ fontSize: 13, color: colors.silver, lineHeight: 13 * 1.5, textAlign: "center", marginTop: 8 }}>
            {friendsPostedToday > 0
              ? `${friendsPostedToday} ${friendsPostedToday === 1 ? "friend" : "friends"} already went today.`
              : "Post a photo from your session to see what everyone else is doing."}
          </Text>
          <Pressable
            onPress={() => router.push("/camera")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.white,
              borderRadius: 999,
              paddingVertical: 12,
              paddingHorizontal: 26,
              marginTop: 16
            }}
          >
            <Camera size={16} color={colors.black} strokeWidth={2.2} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13.5, color: colors.black }}>
              Post today's SPOTTED
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
