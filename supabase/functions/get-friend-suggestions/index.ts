import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const user = await authenticatedUser(request);
    const supabase = serviceClient();
    // Honor the client's requested page size (it was silently ignored before).
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(50, Number((body as { limit?: unknown })?.limit) || 20));
    const { data, error } = await supabase.rpc("get_friend_suggestions", { p_user_id: user.id, p_limit: limit });
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ suggestions: data });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
