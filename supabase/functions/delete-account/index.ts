import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

// Permanently deletes the caller's account: auth user + profile (FK cascades
// remove posts, checkins, streaks, friendships, messages, etc.) and any
// storage objects they own. Required for App Store account-deletion policy.
serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const user = await authenticatedUser(request);
    const supabase = serviceClient();

    // Remove owned storage objects (posts + avatars are keyed by user id prefix)
    for (const bucket of ["posts", "avatars", "messages"]) {
      const { data: objects } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (objects && objects.length > 0) {
        await supabase.storage.from(bucket).remove(objects.map((o) => `${user.id}/${o.name}`));
      }
    }

    // Deleting the auth user cascades to profiles (FK) and from there to all
    // user-owned rows via ON DELETE CASCADE.
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ deleted: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 401);
  }
});
