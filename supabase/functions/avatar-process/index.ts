import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

function objectNameFromBody(body: unknown) {
  if (body && typeof body === "object" && "record" in body && body.record && typeof body.record === "object" && "name" in body.record && typeof body.record.name === "string") {
    return body.record.name;
  }
  if (body && typeof body === "object" && "name" in body && typeof body.name === "string") {
    return body.name;
  }
  throw new Error("invalid_storage_payload");
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const name = objectNameFromBody(await request.json());
    const [userId, filename] = name.split("/");
    if (!userId || !filename || !filename.startsWith("avatar.")) {
      return jsonResponse({ ok: true, ignored: true });
    }
    const extension = filename.split(".").pop() ?? "jpg";
    const blurredPath = `${userId}/blurred.${extension}`;
    const supabase = serviceClient();
    const { data, error } = await supabase.storage.from("avatars").download(name);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    await supabase.storage.from("avatars").upload(blurredPath, data, {
      upsert: true,
      contentType: data.type || "image/jpeg"
    });
    await supabase.from("profiles").update({ avatar_url: name, avatar_blurred_url: blurredPath }).eq("id", userId);
    return jsonResponse({ avatar_blurred_url: blurredPath });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
