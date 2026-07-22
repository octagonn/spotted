import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { Database } from "@/types/database";

/**
 * Silence one specific, benign Supabase auth log. When a stored session's
 * refresh token has expired/rotated/been revoked, gotrue-js logs
 * "Invalid Refresh Token: Refresh Token Not Found" via console.error during
 * its startup refresh — before our auth store can clear the dead session.
 * It's not an error: the app handles it by signing out to the login screen
 * (stores/auth.ts checkSessionAgainstServer → dropInvalidSession). We only
 * drop this exact message so it doesn't surface as a red error on launch;
 * every other console.error passes through untouched. Installed before
 * createClient so it's active before any auth activity.
 */
const REFRESH_TOKEN_NOISE = /invalid refresh token|refresh token not found|refresh_token_not_found/i;
function isRefreshTokenNoise(args: unknown[]): boolean {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return REFRESH_TOKEN_NOISE.test(arg);
    }
    if (arg && typeof arg === "object") {
      const obj = arg as { message?: unknown; code?: unknown };
      return (
        REFRESH_TOKEN_NOISE.test(String(obj.message ?? "")) || String(obj.code ?? "") === "refresh_token_not_found"
      );
    }
    return false;
  });
}
if (!(globalThis as { __spottedAuthNoisePatched?: boolean }).__spottedAuthNoisePatched) {
  (globalThis as { __spottedAuthNoisePatched?: boolean }).__spottedAuthNoisePatched = true;
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (!isRefreshTokenNoise(args)) {
      originalError(...args);
    }
  };
}

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra: Extra = Constants.expoConfig?.extra ?? {};
const configuredUrl = extra.supabaseUrl ?? "";
const configuredAnonKey = extra.supabaseAnonKey ?? "";
const isWebServer = Platform.OS === "web" && typeof window === "undefined";

export const isSupabaseConfigured = configuredUrl.length > 0 && configuredAnonKey.length > 0;

export const supabase = createClient<Database>(
  isSupabaseConfigured ? configuredUrl : "https://example.supabase.co",
  isSupabaseConfigured ? configuredAnonKey : "anon-key-not-configured",
  {
    auth: isWebServer
      ? {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      : {
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

/**
 * Batch-sign post media paths — ONE storage API call per page instead of one
 * per photo (a feed page was issuing dozens, and transient failures made
 * other people's posts render wrong/missing). Retries once; paths that still
 * fail are simply absent from the map, so callers fall back to a placeholder
 * instead of a broken raw path.
 */
export async function signedPostUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p) && !(p as string).startsWith("http")))];
  if (!unique.length) return map;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const missing = unique.filter((p) => !map.has(p));
    if (!missing.length) break;
    try {
      const { data, error } = await supabase.storage.from("posts").createSignedUrls(missing, 60 * 60);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.path && row.signedUrl && !row.error) map.set(row.path, row.signedUrl);
      }
    } catch {
      // swallow and retry once; leftovers stay unsigned
    }
  }
  return map;
}

/** Signed URL for chat media (private messages bucket). */
export async function signedMessageUrl(path: string) {
  const { data, error } = await supabase.storage.from("messages").createSignedUrl(path, 60 * 60);
  if (error) {
    throw error;
  }
  return data.signedUrl;
}
