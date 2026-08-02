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

/**
 * Signed-URL cache. A private-bucket image is fetched via a signed URL with a
 * unique token; re-signing the same path produces a NEW url every time, which
 * makes expo-image's disk cache miss on every refetch (the token changed) and
 * costs a signing round-trip. Caching the signed url per path — stable until
 * near expiry — makes the same image resolve to the same url, so the on-device
 * cache actually hits and we stop re-signing. URLs are signed for 6h; we reuse
 * them until 30 min before expiry.
 */
const SIGN_TTL_SECONDS = 6 * 60 * 60;
const SIGN_REUSE_MS = (SIGN_TTL_SECONDS - 30 * 60) * 1000;
const signedUrlCache = new Map<string, { url: string; at: number }>();

function cachedSigned(path: string, now: number): string | null {
  const hit = signedUrlCache.get(path);
  if (hit && now - hit.at < SIGN_REUSE_MS) return hit.url;
  return null;
}

export async function signedPostUrl(path: string) {
  const now = Date.now();
  const hit = cachedSigned(path, now);
  if (hit) return hit;
  // R2-migrated media ("r2:<key>") signs through the r2-media edge function;
  // legacy paths keep using Supabase Storage. (Import here would be circular —
  // lib/r2 imports the supabase client — so resolve lazily.)
  if (path.startsWith("r2:")) {
    const { r2Key, r2SignDownloads } = await import("@/lib/r2");
    const key = r2Key(path);
    const urls = await r2SignDownloads([key]);
    const url = urls.get(key);
    if (!url) throw new Error("r2_sign_failed");
    signedUrlCache.set(path, { url, at: now });
    return url;
  }
  const { data, error } = await supabase.storage.from("posts").createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error) {
    throw error;
  }
  signedUrlCache.set(path, { url: data.signedUrl, at: now });
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
  const now = Date.now();
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p) && !(p as string).startsWith("http")))];
  if (!unique.length) return map;
  // Reuse cached signed URLs so the same path is stable across refetches.
  for (const path of unique) {
    const hit = cachedSigned(path, now);
    if (hit) map.set(path, hit);
  }
  // Split R2-migrated paths ("r2:<key>") from legacy Supabase Storage paths.
  const r2Paths = unique.filter((p) => !map.has(p) && p.startsWith("r2:"));
  if (r2Paths.length) {
    try {
      const { r2Key, r2SignDownloads } = await import("@/lib/r2");
      const urls = await r2SignDownloads(r2Paths.map(r2Key));
      for (const path of r2Paths) {
        const url = urls.get(r2Key(path));
        if (url) {
          map.set(path, url);
          signedUrlCache.set(path, { url, at: now });
        }
      }
    } catch {
      // leftovers stay unsigned; callers show placeholders
    }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const missing = unique.filter((p) => !map.has(p) && !p.startsWith("r2:"));
    if (!missing.length) break;
    try {
      const { data, error } = await supabase.storage.from("posts").createSignedUrls(missing, SIGN_TTL_SECONDS);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.path && row.signedUrl && !row.error) {
          map.set(row.path, row.signedUrl);
          signedUrlCache.set(row.path, { url: row.signedUrl, at: now });
        }
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
