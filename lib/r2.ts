import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Cloudflare R2 media plumbing (dual-path migration).
 *
 * New media uploads go to R2; their DB paths are stored as "r2:<key>" so the
 * signing layer can route them (legacy paths without the prefix keep using
 * Supabase Storage). The app never holds R2 credentials — the r2-media edge
 * function brokers short-lived presigned URLs.
 *
 * Rollout safety: if the edge function isn't configured yet (secrets missing)
 * or presigning fails, uploads fall back to Supabase Storage transparently.
 */

export const R2_PREFIX = "r2:";

export function isR2Path(path: string): boolean {
  return path.startsWith(R2_PREFIX);
}

export function r2Key(path: string): string {
  return isR2Path(path) ? path.slice(R2_PREFIX.length) : path;
}

type SignBody = {
  action: "upload" | "download" | "delete";
  key?: string;
  keys?: string[];
  contentType?: string;
};

async function invokeR2<T>(body: SignBody): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke<T>("r2-media", { body });
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Upload bytes to R2 under `key`. Returns the stored DB path ("r2:<key>") on
 * success, or null so the caller can fall back to Supabase Storage.
 */
export async function r2Upload(key: string, body: ArrayBuffer, contentType: string): Promise<string | null> {
  const signed = await invokeR2<{ url?: string }>({ action: "upload", key, contentType });
  if (!signed?.url) return null;
  try {
    const res = await fetch(signed.url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body
    });
    if (!res.ok) {
      logger.warn("r2_upload_failed", { status: res.status, key });
      return null;
    }
    return `${R2_PREFIX}${key}`;
  } catch (error) {
    logger.warn("r2_upload_failed", {
      message: error instanceof Error ? error.message : String(error),
      key
    });
    return null;
  }
}

/** Batch presigned GET URLs for R2 keys (NOT prefixed). Missing = failed. */
export async function r2SignDownloads(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!keys.length) return map;
  const data = await invokeR2<{ urls?: Record<string, string> }>({ action: "download", keys });
  for (const [key, url] of Object.entries(data?.urls ?? {})) {
    map.set(key, url);
  }
  return map;
}

/** Best-effort delete of own R2 objects (prefix-enforced server-side). */
export async function r2Delete(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await invokeR2<{ deleted?: number }>({ action: "delete", keys });
}

/**
 * Upload a post-bucket object: R2 first, Supabase Storage as fallback.
 * Returns the DB path to store — "r2:<key>" when it landed in R2, the plain
 * key when it fell back. Throws only when BOTH targets fail.
 */
export async function uploadPostObject(key: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const viaR2 = await r2Upload(key, body, contentType);
  if (viaR2) return viaR2;
  const upload = await supabase.storage.from("posts").upload(key, body, { contentType, upsert: false });
  if (upload.error) throw upload.error;
  return key;
}

/**
 * Remove post-bucket objects on either storage path. Mixed lists are fine:
 * "r2:" keys delete via the edge function, the rest via Supabase Storage.
 */
export async function removePostObjects(paths: string[]): Promise<void> {
  const r2Keys = paths.filter(isR2Path).map(r2Key);
  const legacy = paths.filter((p) => !isR2Path(p));
  if (r2Keys.length) await r2Delete(r2Keys);
  if (legacy.length) {
    await supabase.storage.from("posts").remove(legacy).catch(() => {});
  }
}
