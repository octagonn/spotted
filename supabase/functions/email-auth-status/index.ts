import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const startedAt = Date.now();
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!emailPattern.test(email) || email.length > 254) {
      return jsonResponse({ error: "invalid_email" }, 400);
    }

    const { data, error } = await serviceClient().rpc("email_auth_method", {
      lookup_email: email
    });
    if (error) {
      throw error;
    }

    // Keep response timing less useful for bulk account enumeration.
    const remainingDelay = 300 - (Date.now() - startedAt);
    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }
    return jsonResponse({ method: data === "password" ? "password" : "otp" });
  } catch {
    return jsonResponse({ error: "lookup_failed" }, 500);
  }
});
