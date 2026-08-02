import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { headObject, putObject, r2FromEnv } from "../_shared/r2.ts";
import { isServiceRequest, serviceClient } from "../_shared/supabase.ts";

/**
 * One-off migration: copy every object in the Supabase Storage `posts` bucket
 * to R2 under the SAME key. Service-role only. Idempotent — objects already in
 * R2 (matching size) are skipped, so it can be re-run until `remaining` is 0.
 * The DB path flip ("<key>" → "r2:<key>") happens separately once everything
 * verifies; Supabase objects are left in place as a rollback safety net.
 *
 * Body: { limit?: number }  → { copied, skipped, remaining, failures }
 */

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    if (!isServiceRequest(request)) return jsonResponse({ error: "service_only" }, 403);
    const r2 = r2FromEnv();
    if (!r2) return jsonResponse({ error: "r2_not_configured" }, 500);
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);

    const supabase = serviceClient();

    // Enumerate every object: the bucket is one level deep (<userId>/<name>).
    const { data: folders, error: rootError } = await supabase.storage.from("posts").list("", { limit: 1000 });
    if (rootError) return jsonResponse({ error: rootError.message }, 500);
    const keys: string[] = [];
    for (const folder of folders ?? []) {
      if (folder.id) continue; // a file at root, not a folder — ignore
      const { data: objects } = await supabase.storage.from("posts").list(folder.name, { limit: 1000 });
      for (const o of objects ?? []) keys.push(`${folder.name}/${o.name}`);
    }

    let copied = 0;
    let skipped = 0;
    const failures: string[] = [];
    let remaining = 0;
    for (const key of keys) {
      const existing = await headObject(r2, key);
      if (existing !== null) {
        skipped += 1;
        continue;
      }
      if (copied >= limit) {
        remaining += 1;
        continue;
      }
      const { data: blob, error: dlError } = await supabase.storage.from("posts").download(key);
      if (dlError || !blob) {
        failures.push(`${key}: download ${dlError?.message ?? "empty"}`);
        continue;
      }
      const bytes = await blob.arrayBuffer();
      const ok = await putObject(r2, key, bytes, contentTypeFor(key));
      if (!ok) {
        failures.push(`${key}: put failed`);
        continue;
      }
      const size = await headObject(r2, key);
      if (size !== bytes.byteLength) {
        failures.push(`${key}: size mismatch ${size} != ${bytes.byteLength}`);
        continue;
      }
      copied += 1;
    }

    return jsonResponse({ total: keys.length, copied, skipped, remaining, failures });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
