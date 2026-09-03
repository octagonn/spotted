import * as Location from "expo-location";
import { router } from "expo-router";
import { Bell, MapPin } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import Animated from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { logger } from "@/lib/logger";
import { registerDeviceToken } from "@/lib/notifications";
import { advanceOnboarding } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

type Status = "idle" | "granted" | "denied";

export default function PermissionsScreen() {
  const { fadeStyle, fadeNavigate } = usePageFade();
  const [locationStatus, setLocationStatus] = useState<Status>("idle");
  const [notifStatus, setNotifStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);
  const userId = useAuthStore((state) => state.userId);

  async function handleLocation() {
    setBusy(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(fg.granted ? "granted" : "denied");
    } finally {
      setBusy(false);
    }
  }

  async function handleNotifications() {
    setBusy(true);
    try {
      if (isSupabaseConfigured && userId) {
        try {
          const token = await registerDeviceToken(userId, { requestPermission: true });
          setNotifStatus(token ? "granted" : "denied");
        } catch (error) {
          setNotifStatus("denied");
          logger.warn("device_token_registration_failed", {
            message: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        setNotifStatus("denied");
      }
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(status: Status) {
    if (status === "granted") return "GRANTED";
    if (status === "denied") return "DENIED";
    return "TAP TO ENABLE";
  }

  function statusColor(status: Status) {
    if (status === "granted") return "text-white";
    if (status === "denied") return "text-fog";
    return "text-mist";
  }

  return (
    <Animated.View style={[{ flex: 1 }, fadeStyle]}>
      <Screen transparent>
        <OnboardingHeader
          step={5}
          title="LET IT WATCH."
          body="Location finds gyms near you and verifies check-ins. Notifications make skipping public enough to matter."
        />

        <View className="mt-8 gap-3">
          <Pressable
            accessibilityLabel={`Location while using, ${statusLabel(locationStatus).toLowerCase()}`}
            accessibilityHint="Verify gym check-ins and find nearby gyms"
            className="flex-row items-center gap-4 rounded-card border border-hairline-strong bg-glass-strong p-4"
            onPress={handleLocation}
          >
            <View className="h-12 w-12 items-center justify-center rounded-full border border-hairline-strong bg-glass-soft">
              <MapPin color={colors.white} size={icon.size.sm} strokeWidth={icon.stroke.thin} />
            </View>
            <View className="flex-1">
              <Text variant="body-strong">Location While Using</Text>
              <Text variant="caption" className="mt-1 text-mist">
                Verify gym check-ins and find nearby gyms.
              </Text>
            </View>
            <Text variant="micro" accessibilityLiveRegion="polite" className={statusColor(locationStatus)}>
              {statusLabel(locationStatus)}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={`Notifications, ${statusLabel(notifStatus).toLowerCase()}`}
            accessibilityHint="Views, streak breaks, DMs, and gym arrivals"
            className="flex-row items-center gap-4 rounded-card border border-hairline-strong bg-glass-strong p-4"
            onPress={handleNotifications}
          >
            <View className="h-12 w-12 items-center justify-center rounded-full border border-hairline-strong bg-glass-soft">
              <Bell color={colors.white} size={icon.size.sm} strokeWidth={icon.stroke.thin} />
            </View>
            <View className="flex-1">
              <Text variant="body-strong">Notifications</Text>
              <Text variant="caption" className="mt-1 text-mist">
                Views, streak breaks, DMs, and gym arrivals.
              </Text>
            </View>
            <Text variant="micro" accessibilityLiveRegion="polite" className={statusColor(notifStatus)}>
              {statusLabel(notifStatus)}
            </Text>
          </Pressable>
        </View>

        <Button
          className="mt-10"
          loading={busy}
          onPress={() => {
            void advanceOnboarding(userId, "home-gym");
            fadeNavigate(() => router.push("/privacy"));
          }}
        >
          Continue
        </Button>
        <Pressable
          className="mt-4 self-center"
          onPress={() => {
            void advanceOnboarding(userId, "home-gym");
            fadeNavigate(() => router.push("/privacy"));
          }}
        >
          <Text variant="micro" className="text-mist">
            DO IT LATER
          </Text>
        </Pressable>
      </Screen>
    </Animated.View>
  );
}
