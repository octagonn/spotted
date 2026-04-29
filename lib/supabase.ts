import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra: Extra = Constants.expoConfig?.extra ?? {};
const configuredUrl = extra.supabaseUrl ?? "";
const configuredAnonKey = extra.supabaseAnonKey ?? "";

export const isSupabaseConfigured = configuredUrl.length > 0 && configuredAnonKey.length > 0;

export const supabase = createClient<Database>(
  isSupabaseConfigured ? configuredUrl : "https://example.supabase.co",
  isSupabaseConfigured ? configuredAnonKey : "anon-key-not-configured",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

export function publicAvatarUrl(path?: string | null) {
  if (!path || !isSupabaseConfigured) {
    return null;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export async function signedPostUrl(path: string) {
  const { data, error } = await supabase.storage.from("posts").createSignedUrl(path, 60 * 60);
  if (error) {
    throw error;
  }
  return data.signedUrl;
}
