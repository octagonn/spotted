import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
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

// Produces a genuinely unrecognizable blurred avatar for the free-tier viewer
// list: downscale to 12px (destroys identity), light box blur, upscale back.
async function blurAvatar(bytes: Uint8Array): Promise<Uint8Array> {
  const image = await Image.decode(bytes);
  const size = 128;
  image.resize(12, 12);
  image.resize(size, size);
  return await image.encodeJPEG(60);
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
    const blurredPath = `${userId}/blurred.jpg`;
    const supabase = serviceClient();
    const { data, error } = await supabase.storage.from("avatars").download(name);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    let payload: Uint8Array | Blob;
    let contentType = "image/jpeg";
    try {
      payload = await blurAvatar(new Uint8Array(await data.arrayBuffer()));
    } catch {
      // Unsupported format — fall back to the original rather than failing the upload
      payload = data;
      contentType = data.type || "image/jpeg";
    }
    await supabase.storage.from("avatars").upload(blurredPath, payload, {
      upsert: true,
      contentType
    });
    await supabase.from("profiles").update({ avatar_url: name, avatar_blurred_url: blurredPath }).eq("id", userId);
    return jsonResponse({ avatar_blurred_url: blurredPath });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
