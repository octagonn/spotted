import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { useBannerStore } from "@/stores/banner";
import { colors } from "@/theme/colors";

/**
 * Top-of-screen banner for DMs/taunts received while the app is open. Slides in,
 * auto-dismisses after ~4s, tap to open the relevant screen. Mounted once at the
 * root, above everything.
 */
export function NotificationBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const banner = useBannerStore((s) => s.banner);
  const dismiss = useBannerStore((s) => s.dismiss);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!banner) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => dismiss(), 4200);
    return () => clearTimeout(timer.current);
  }, [banner, dismiss]);

  if (!banner) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutUp.duration(220)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingHorizontal: 12, zIndex: 9999 }}
    >
      <Pressable
        onPress={() => {
          dismiss();
          router.push(banner.route as never);
        }}
        haptic={false}
        accessibilityLabel={banner.title}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: colors.charcoal,
            borderWidth: 1,
            borderColor: colors.iron,
            shadowColor: "#000",
            shadowOpacity: 0.5,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10
          }}
        >
          <Avatar name={banner.avatarName} uri={banner.avatarUrl} size={40} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>
              {banner.title}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: colors.silver }}>
              {banner.body}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
