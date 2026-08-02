import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("missing_supabase_service_env");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
}

/**
 * True when the caller authenticated with the project's service-role key
 * (server-side callers: moderation worker, migration scripts, cron).
 * Accepts both the new-format secret key (matches the runtime env) and the
 * legacy service_role JWT — the gateway (verify_jwt) has already validated
 * the signature, so trusting the decoded role claim is safe.
 */
export function isServiceRequest(request: Request): boolean {
  const token = (request.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return false;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return true;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace("Bearer ", "");
  if (!token) {
    throw new Error("missing_auth_token");
  }
  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("invalid_auth_token");
  }
  return data.user;
}
