// Attach Sign in with Apple to the caller's EXISTING Spotted account.
//
// Why this exists (see also lib/auth.ts):
//   * Signing in with the Apple token while already logged in only links when
//     Apple hands back an email matching the account. With Hide My Email it
//     instead creates a junk @privaterelay account and drops the user into it.
//   * Supabase's supported manual-link path uses Apple's WEB flow, which needs
//     a Services ID. This project is configured with the iOS bundle ID (an App
//     ID), so appleid.apple.com answers "Sign Up Not Completed".
//
// So the link happens here: the app sends the identity token from the native
// Apple sheet, this verifies it against Apple's published keys, and the DB half
// runs in attach_apple_identity() (service-role only). Email is never used to
// decide anything, so Hide My Email works and no stray account is created.
//
// SECURITY — the token is the entire proof of Apple ownership, so it is checked
// against every property Apple documents before anything is written:
//   1. RS256 signature against Apple's live JWKS  (forged tokens rejected)
//   2. iss === https://appleid.apple.com          (other issuers rejected)
//   3. aud === this app's bundle id               (tokens for other apps rejected)
//   4. exp / nbf enforced by jose                 (replayed old tokens rejected)
// The Apple subject is then bound to the CALLER's own user id, taken from their
// verified Supabase JWT — a request can never target another account.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/** Audience Apple mints native tokens for = this app's bundle id. */
const APPLE_AUDIENCE = (Deno.env.get("APPLE_BUNDLE_ID") ?? "com.octavio.spotted")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const APPLE_ISSUER = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // --- who is asking (their own JWT, verified by GoTrue) ---
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthorized" });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json(401, { error: "unauthorized" });

  let identityToken = "";
  try {
    const body = (await req.json()) as { identityToken?: string };
    identityToken = typeof body.identityToken === "string" ? body.identityToken : "";
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (!identityToken) return json(400, { error: "missing_identity_token" });

  // --- prove the caller controls this Apple ID ---
  let appleSub = "";
  let appleEmail: string | null = null;
  let appleEmailVerified = false;
  try {
    const { payload } = await jwtVerify(identityToken, appleKeys, {
      issuer: APPLE_ISSUER,
      audience: APPLE_AUDIENCE,
      algorithms: ["RS256"]
    });
    appleSub = typeof payload.sub === "string" ? payload.sub : "";
    appleEmail = typeof payload.email === "string" ? payload.email : null;
    // Apple sends this as a boolean or the string "true" depending on flow.
    appleEmailVerified = payload.email_verified === true || payload.email_verified === "true";
  } catch (error) {
    console.warn("apple token rejected:", error instanceof Error ? error.message : error);
    return json(401, { error: "invalid_apple_token" });
  }
  if (!appleSub) return json(401, { error: "invalid_apple_token" });

  // --- attach (service-role only; all conflict rules live in the function) ---
  const { data, error } = await db.rpc("attach_apple_identity", {
    p_user: user.id,
    p_sub: appleSub,
    p_email: appleEmail,
    p_email_verified: appleEmailVerified
  });
  if (error) {
    console.error("attach_apple_identity failed:", error.message);
    return json(500, { error: "link_failed" });
  }

  const status = String(data ?? "");
  if (status === "linked" || status === "already_linked") return json(200, { status });
  if (status === "apple_id_in_use") return json(409, { error: "apple_id_in_use" });
  if (status === "already_has_apple") return json(409, { error: "already_has_apple" });
  return json(500, { error: "link_failed" });
});
