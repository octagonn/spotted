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
    const { data: post, error: postError } = await supabase.from("posts").select("user_id").eq("id", postId).single();
    if (postError || post.user_id !== user.id) {
      return jsonResponse({ error: "forbidden" }, 403);
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }
    const { count, error: countError } = await supabase.from("post_views").select("*", { count: "exact", head: true }).eq("post_id", postId);
    if (countError) {
      return jsonResponse({ error: countError.message }, 500);
    }
    if (profile.subscription_tier === "plus") {
      const { data, error } = await supabase
        .from("post_views")
        .select("profiles:viewer_id(id, username, display_name, avatar_url)")
        .eq("post_id", postId)
        .order("viewed_at", { ascending: false });
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ tier: "plus", total_count: count ?? 0, viewers: data.map((row) => row.profiles) });
    }
    const { data, error } = await supabase
      .from("post_views")
      .select("profiles:viewer_id(avatar_blurred_url)")
      .eq("post_id", postId)
      .order("viewed_at", { ascending: false })
      .limit(3);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ tier: "free", total_count: count ?? 0, viewers: data.map((row) => row.profiles) });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
