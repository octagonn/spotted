import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

function postIdFromBody(body: unknown) {
  if (body && typeof body === "object" && "post_id" in body && typeof body.post_id === "string") {
    return body.post_id;
  }
  throw new Error("invalid_post_id");
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const user = await authenticatedUser(request);
    const postId = postIdFromBody(await request.json());
    const supabase = serviceClient();
    const { data: readable, error: readableError } = await supabase.rpc("can_read_post", {
      p_post_id: postId,
      p_user_id: user.id
    });
    if (readableError || !readable) {
      return jsonResponse({ error: "forbidden" }, 403);
    }
    const { data: post, error } = await supabase.from("posts").select("media_url").eq("id", postId).single();
    if (error) {
      return jsonResponse({ error: error.message }, 404);
    }
    const { data, error: signedError } = await supabase.storage.from("posts").createSignedUrl(post.media_url, 60 * 60);
    if (signedError) {
      return jsonResponse({ error: signedError.message }, 500);
    }
    return jsonResponse({ signed_url: data.signedUrl });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
