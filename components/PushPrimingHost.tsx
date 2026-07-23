import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { PushPrimingSheet } from "@/components/PushPrimingSheet";
import { useNotificationPrefs } from "@/hooks/queries/useNotificationPrefs";
import { useUserCounts } from "@/hooks/queries/useUserCounts";
import { registerDeviceToken } from "@/lib/notifications";
import { logger } from "@/lib/logger";
import { useAuthStore } from "@/stores/auth";

const DISMISS_KEY = "push-priming-dismissed-at-posts";

/**
 * Permission priming controller (spec). Never prompts at cold launch. Shows the
 * custom pre-permission sheet once the user has ≥1 post; if they dismiss, it
 * re-primes only after their 3rd post. Only "Turn on" calls the OS prompt.
 */
export function PushPrimingHost() {
  const userId = useAuthStore((state) => state.userId);
  const prefs = useNotificationPrefs();
  const counts = useUserCounts(userId);
  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);

  const postCount = counts.data?.posts ?? 0;
  const status = prefs.data?.pushPermissionStatus;

  useEffect(() => {
    // iOS-only surface (Android auto-grants); only for users who haven't been
    // asked the OS prompt yet.
    if (Platform.OS !== "ios" || !userId || checkedRef.current) return;
    if (!prefs.data || status !== "not_asked" || postCount < 1) return;
    checkedRef.current = true;
    void (async () => {
      const raw = await AsyncStorage.getItem(DISMISS_KEY);
      const dismissedAt = raw ? Number(raw) : null;
      // First eligibility (≥1 post) shows it; a prior dismissal re-primes only
      // once the user has reached 3 posts.
      if (dismissedAt === null || postCount >= 3) {
        setVisible(true);
      }
    })();
  }, [prefs.data, status, postCount, userId]);

  const enable = () => {
    setVisible(false);
    void (async () => {
      try {
        if (userId) await registerDeviceToken(userId);
        void prefs.refetch();
      } catch (error) {
        logger.warn("push_priming_enable_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  };

  const dismiss = () => {
    setVisible(false);
    void AsyncStorage.setItem(DISMISS_KEY, String(postCount)).catch(() => undefined);
  };

  return <PushPrimingSheet visible={visible} onEnable={enable} onDismiss={dismiss} />;
}
