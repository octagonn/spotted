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
