import { useEffect, useState } from "react";

import { signedPostUrl } from "@/lib/supabase";

/**
 * Every image the app stores lives in Cloudflare R2 and is referenced in the
 * database as "r2:<key>" (avatars, community photos, posts, stories, chat
 * media, reaction selfies). Nothing is served from Supabase Storage.
 *
 * `useResolvedUri` turns such a reference into a short-lived signed URL
 * (cached ~6h in lib/supabase's signed-url cache, so lists don't re-sign).
 * Anything already absolute (https, file, ph, content) passes through as-is.
 */
export function isStoredMediaRef(uri: string | null | undefined): uri is string {
  return typeof uri === "string" && uri.startsWith("r2:");
}

const inFlight = new Map<string, Promise<string | null>>();

export function resolveMediaUri(uri: string): Promise<string | null> {
  if (!isStoredMediaRef(uri)) return Promise.resolve(uri);
  let p = inFlight.get(uri);
  if (!p) {
    p = signedPostUrl(uri).catch(() => null).finally(() => inFlight.delete(uri));
    inFlight.set(uri, p);
  }
  return p;
}

export function useResolvedUri(uri: string | null | undefined): string | null {
  const needsResolve = isStoredMediaRef(uri);
  const [resolved, setResolved] = useState<string | null>(needsResolve ? null : (uri ?? null));
  useEffect(() => {
    if (!needsResolve) {
      setResolved(uri ?? null);
      return;
    }
    let cancelled = false;
    setResolved(null);
    void resolveMediaUri(uri).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [uri, needsResolve]);
  return resolved;
}
