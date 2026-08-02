import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser } from "../_shared/supabase.ts";

/**
 * Cloudflare R2 presigned-URL broker. The app never holds R2 credentials —
 * it asks this function for short-lived signed URLs and talks to R2 directly.
 *
 * Actions (POST, authenticated):
 *   { action: "upload",   key, contentType }  → { url }   presigned PUT, 10 min
 *   { action: "download", keys: string[] }    → { urls: { [key]: url } } 6 h
 *   { action: "delete",   keys: string[] }    → { deleted: number }
 *
 * Rules:
 *   - upload/delete only within the caller's own prefix ("<userId>/...")
 *   - download is any-key for authenticated users: keys are unguessable
 *     (uuid + timestamp) and only discoverable through RLS-protected rows,
 *     matching the existing private-bucket signed-URL model
 *
 * Env (Supabase edge-function secrets):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
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

function r2Client() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    aws: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
  };
}

async function presign(
  client: NonNullable<ReturnType<typeof r2Client>>,
  method: "GET" | "PUT" | "DELETE",
  key: string,
  ttlSeconds: number
): Promise<string> {
  const url = new URL(`${client.base}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
  const signed = await client.aws.sign(new Request(url.toString(), { method }), {
    aws: { signQuery: true }
  });
  return signed.url;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const user = await authenticatedUser(request);
    const client = r2Client();
    if (!client) return jsonResponse({ error: "r2_not_configured" }, 500);

    const body = (await request.json()) as {
      action?: string;
      key?: string;
      keys?: string[];
      contentType?: string;
    };

    if (body.action === "upload") {
      if (!validKey(body.key)) return jsonResponse({ error: "invalid_key" }, 400);
      if (!body.key.startsWith(`${user.id}/`)) return jsonResponse({ error: "forbidden_prefix" }, 403);
      if (!body.contentType || !ALLOWED_CONTENT_TYPES.has(body.contentType)) {
        return jsonResponse({ error: "invalid_content_type" }, 400);
      }
      const url = await presign(client, "PUT", body.key, UPLOAD_TTL_SECONDS);
      return jsonResponse({ url });
    }

    if (body.action === "download") {
      const keys = Array.isArray(body.keys) ? body.keys.slice(0, MAX_BATCH) : [];
      const urls: Record<string, string> = {};
      for (const key of keys) {
        if (!validKey(key)) continue;
        urls[key] = await presign(client, "GET", key, DOWNLOAD_TTL_SECONDS);
      }
      return jsonResponse({ urls });
    }

    if (body.action === "delete") {
      const keys = Array.isArray(body.keys) ? body.keys.slice(0, MAX_BATCH) : [];
      let deleted = 0;
      for (const key of keys) {
        if (!validKey(key) || !key.startsWith(`${user.id}/`)) continue;
        const url = await presign(client, "DELETE", key, 60);
        const res = await fetch(url, { method: "DELETE" });
        if (res.ok || res.status === 404) deleted += 1;
      }
      return jsonResponse({ deleted });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
