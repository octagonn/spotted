import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

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
