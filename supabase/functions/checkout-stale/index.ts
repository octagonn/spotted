import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const supabase = serviceClient();
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .is("checked_out_at", null)
    .lt("checked_in_at", cutoff)
    .select("id");
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  return jsonResponse({ closed: data.length });
});
