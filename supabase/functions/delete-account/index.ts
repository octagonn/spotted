import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

// Permanently deletes the caller's account. Required for App Store
// account-deletion policy.
//
// Order matters (defense in depth): storage → profile row → auth user.
// Deleting the PROFILE first cascades through the entire public graph
// (posts, friendships/requests, messages, stories, workouts, reactions,
// notifications, community memberships, …) via ON DELETE CASCADE. So even if
// the final auth deletion hiccups, no social data survives — a re-signup on
// the same email can never resurrect old friend requests or messages. The
// 2026-07 incident was exactly that: a failed deleteUser left the account
// fully intact and a same-email "new account" was really the old one.
serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const user = await authenticatedUser(request);
    const supabase = serviceClient();

    // 1) Storage objects keyed by user-id prefix (all user-content buckets).
    for (const bucket of ["posts", "avatars", "messages", "reactions"]) {
      const { data: objects } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      if (objects && objects.length > 0) {
        await supabase.storage.from(bucket).remove(objects.map((o) => `${user.id}/${o.name}`));
      }
    }

    // 2) Public data — profile delete cascades through everything user-owned.
    const { error: profileError } = await supabase.from("profiles").delete().eq("id", user.id);
    if (profileError) {
      return jsonResponse({ error: `profile_delete_failed: ${profileError.message}` }, 500);
    }

    // 3) Auth user (frees the email). Public data is already gone at this point.
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ deleted: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 401);
  }
});
