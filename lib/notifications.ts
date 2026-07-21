import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export async function registerDeviceToken(userId: string) {
  if (Platform.OS !== "ios" || !Device.isDevice) {
    return null;
  }
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const token = await Notifications.getDevicePushTokenAsync();
  const platform = "ios";
  const { error } = await supabase.from("device_tokens").upsert({
    user_id: userId,
    device_token: token.data,
    platform
  });
  if (error) {
    throw error;
  }
  return token.data;
}

/**
 * On app start, re-register the device push token when the user is signed in
 * and notification permission has already been granted (never prompts).
 */
export function usePushTokenSync(userId: string | null) {
  useEffect(() => {
    if (!isSupabaseConfigured || !userId || Platform.OS !== "ios" || !Device.isDevice) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted || cancelled) {
          return;
        }
        await registerDeviceToken(userId);
      } catch (error) {
        logger.warn("push_token_sync_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
