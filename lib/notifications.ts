import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { logger } from "@/lib/logger";
import { routeForNotification } from "@/lib/notificationRouting";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const TOKEN_STORAGE_KEY = "spotted:expo-push-token";
const ANDROID_CHANNELS = {
  social: {
    name: "Social",
    description: "Friend activity, reactions, tags, and community updates"
  },
  messages: {
    name: "Messages",
    description: "Direct messages"
  },
  reminders: {
    name: "Reminders",
    description: "Gym and posting reminders"
  }
} as const;

export type PushPermissionStatus = "not_asked" | "granted" | "denied";

// Remote pushes already go through the user's server-side preferences and quiet
// hours. When one arrives while Spotted is open, present it like a normal
// notification instead of silently dropping it.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
}
function supportsPush() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function projectId(): string {
  const value = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("missing_eas_project_id");
  }
  return value;
}

function permissionIsGranted(permission: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === "ios") {
    const iosStatus = permission.ios?.status;
    return (
      iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
    );
  }
  return permission.granted || permission.status === "granted";
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!supportsPush()) return "denied";
  const permission = await Notifications.getPermissionsAsync();
  if (permissionIsGranted(permission)) return "granted";
  return permission.status === "undetermined" ? "not_asked" : "denied";
}

async function configureAndroidChannels() {
  if (Platform.OS !== "android") return;
  await Promise.all(
    Object.entries(ANDROID_CHANNELS).map(([id, channel]) =>
      Notifications.setNotificationChannelAsync(id, {
        name: channel.name,
        description: channel.description,
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 220, 120, 220],
        lightColor: "#FFFFFF",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE
      })
    )
  );
}

async function recordPermissionStatus(userId: string, status: PushPermissionStatus, prompted: boolean) {
  const patch: Record<string, unknown> = {
    user_id: userId,
    push_permission_status: status,
    updated_at: new Date().toISOString()
  };
  if (prompted) patch.push_prompt_shown_at = new Date().toISOString();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(patch as never, { onConflict: "user_id" });
  if (error) {
    logger.warn("push_permission_status_write_failed", { message: error.message });
  }
}

async function saveExpoToken(userId: string, expoPushToken: string) {
  const { error } = await supabase.rpc("register_push_token", {
    p_token: expoPushToken,
    p_platform: Platform.OS
  });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, expoPushToken);
  await recordPermissionStatus(userId, "granted", false);
}

/**
 * Register this installation with Expo Push Service and atomically assign its
 * token to the signed-in account. Reassignment prevents an account switch from
 * sending one user's private alerts to the previous account on the same phone.
 */
export async function registerDeviceToken(
  userId: string,
  options: { requestPermission?: boolean } = {}
) {
  if (!isSupabaseConfigured || !supportsPush()) return null;

  await configureAndroidChannels();
  let permission = await Notifications.getPermissionsAsync();
  const shouldPrompt = !permissionIsGranted(permission) && options.requestPermission !== false;
  if (shouldPrompt) {
    permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true
      }
    });
  }

  const status: PushPermissionStatus = permissionIsGranted(permission)
    ? "granted"
    : permission.status === "undetermined"
      ? "not_asked"
      : "denied";
  await recordPermissionStatus(userId, status, shouldPrompt);
  if (status !== "granted") return null;

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({
      projectId: projectId()
    })
  ).data;
  if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(expoPushToken)) {
    throw new Error("invalid_expo_push_token");
  }
  await saveExpoToken(userId, expoPushToken);
  return expoPushToken;
}

/** Remove this installation from the current account before signing out. */
export async function unregisterCurrentPushToken() {
  if (!isSupabaseConfigured || !supportsPush()) return;
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;
  const { error } = await supabase.rpc("unregister_push_token", { p_token: token });
  if (error) throw error;
}

/**
 * Keep a granted device registered across launches, foreground transitions,
 * network recovery, and native token rotation. This path never opens an OS
 * permission prompt.
 */
export function usePushTokenSync(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !userId || !supportsPush()) return;
    let cancelled = false;

    const sync = async () => {
      try {
        if (cancelled || (await getPushPermissionStatus()) !== "granted") return;
        await registerDeviceToken(userId, { requestPermission: false });
      } catch (error) {
        logger.warn("push_token_sync_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    };

    void sync();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    const tokenRoll = Notifications.addPushTokenListener(() => {
      void sync();
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      void queryClient.invalidateQueries({ queryKey: ["incoming-requests"] });
    });

    return () => {
      cancelled = true;
      appState.remove();
      tokenRoll.remove();
      received.remove();
    };
  }, [queryClient, userId]);
}

const handledResponses = new Set<string>();

/** Route warm and cold notification taps, mark the activity read, and clear it from the app badge. */
export function useNotificationObserver(userId: string | null) {
  const queryClient = useQueryClient();
  const latestUserId = useRef(userId);
  latestUserId.current = userId;

  useEffect(() => {
    if (!supportsPush()) return;

    const handle = async (response: Notifications.NotificationResponse) => {
      if (!latestUserId.current) return;
      const identifier = response.notification.request.identifier;
      if (handledResponses.has(identifier)) return;
      handledResponses.add(identifier);

      const data = response.notification.request.content.data as Record<string, unknown>;
      const notificationId =
        typeof data.notification_id === "string" ? data.notification_id : null;
      if (notificationId && isSupabaseConfigured) {
        const { error } = await supabase.rpc("mark_notification_opened", {
          p_notification_id: notificationId
        });
        if (error) {
          logger.warn("notification_open_write_failed", { message: error.message });
        }
      }

      const route = routeForNotification({
        type: typeof data.type === "string" ? data.type : null,
        actorId: typeof data.actor_id === "string" ? data.actor_id : null,
        actorUsername: typeof data.actor_username === "string" ? data.actor_username : null,
        payload:
          data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
            ? (data.payload as Record<string, unknown>)
            : null,
        url: data.url
      });
      router.push(route as never);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void Notifications.setBadgeCountAsync(0).catch(() => false);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handle(response);
    });

    if (userId) {
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        void handle(lastResponse).finally(() => {
          Notifications.clearLastNotificationResponse();
        });
      }
    }

    return () => subscription.remove();
  }, [queryClient, userId]);
}
