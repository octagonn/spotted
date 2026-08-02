import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, isServiceRequest } from "../_shared/supabase.ts";
import { deleteObject, presign, purgePrefix, r2FromEnv } from "../_shared/r2.ts";

/**
 * Cloudflare R2 presigned-URL broker. The app never holds R2 credentials —
 * it asks this function for short-lived signed URLs and talks to R2 directly.
 *
 * Actions (POST):
 *   { action: "upload",   key, contentType }  → { url }   presigned PUT, 10 min
 *   { action: "download", keys: string[] }    → { urls: { [key]: url } } 6 h
 *   { action: "delete",   keys: string[] }    → { deleted: number }
 *   { action: "purge-prefix", prefix }        → { deleted } (service only)
 *
 * Auth:
 *   - User JWT: upload/delete restricted to the caller's own prefix
 *     ("<userId>/..."); download is any-key (keys are unguessable and only
 *     discoverable via RLS-protected rows — same model as private signed URLs)
 *   - Service-role key: unrestricted (moderation worker, deletion flows, cron)
 */

const UPLOAD_TTL_SECONDS = 10 * 60;
const DOWNLOAD_TTL_SECONDS = 6 * 60 * 60; // matches the app's signed-url cache
const MAX_BATCH = 200;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime"
]);

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]{2,299}$/;

function validKey(key: unknown): key is string {
  return typeof key === "string" && KEY_PATTERN.test(key) && !key.includes("..");
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const service = isServiceRequest(request);
    const user = service ? null : await authenticatedUser(request);
    const r2 = r2FromEnv();
    if (!r2) return jsonResponse({ error: "r2_not_configured" }, 500);

    const body = (await request.json()) as {
      action?: string;
      key?: string;
      keys?: string[];
      prefix?: string;
      contentType?: string;
    };

    if (body.action === "upload") {
      if (!validKey(body.key)) return jsonResponse({ error: "invalid_key" }, 400);
      if (user && !body.key.startsWith(`${user.id}/`)) return jsonResponse({ error: "forbidden_prefix" }, 403);
      if (!body.contentType || !ALLOWED_CONTENT_TYPES.has(body.contentType)) {
        return jsonResponse({ error: "invalid_content_type" }, 400);
      }
      const url = await presign(r2, "PUT", body.key, UPLOAD_TTL_SECONDS);
      return jsonResponse({ url });
    }

    if (body.action === "download") {
      const keys = Array.isArray(body.keys) ? body.keys.slice(0, MAX_BATCH) : [];
      const urls: Record<string, string> = {};
      for (const key of keys) {
        if (!validKey(key)) continue;
        urls[key] = await presign(r2, "GET", key, DOWNLOAD_TTL_SECONDS);
      }
      return jsonResponse({ urls });
    }

    if (body.action === "delete") {
      const keys = Array.isArray(body.keys) ? body.keys.slice(0, MAX_BATCH) : [];
      let deleted = 0;
      for (const key of keys) {
        if (!validKey(key)) continue;
        if (user && !key.startsWith(`${user.id}/`)) continue;
        if (await deleteObject(r2, key)) deleted += 1;
      }
      return jsonResponse({ deleted });
    }

    if (body.action === "purge-prefix") {
      if (!service) return jsonResponse({ error: "service_only" }, 403);
      if (typeof body.prefix !== "string" || body.prefix.length < 8) {
        return jsonResponse({ error: "invalid_prefix" }, 400);
      }
      const deleted = await purgePrefix(r2, body.prefix);
      return jsonResponse({ deleted });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
