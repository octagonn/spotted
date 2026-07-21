import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Buffer } from "node:buffer";
import { X509Certificate } from "node:crypto";
import * as jose from "https://esm.sh/jose@5.9.6";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

// Apple publishes its root CA at a fixed URL; fetched once per isolate and
// pinned so a forged x5c chain cannot terminate anywhere else.
const APPLE_ROOT_URL = "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer";
let appleRootDer: Buffer | null = null;

async function appleRoot(): Promise<Buffer> {
  if (!appleRootDer) {
    const response = await fetch(APPLE_ROOT_URL);
    if (!response.ok) {
      throw new Error("apple_root_fetch_failed");
    }
    appleRootDer = Buffer.from(await response.arrayBuffer());
  }
  return appleRootDer;
}

// Verifies an App Store Server JWS: x5c chain must terminate at the pinned
// Apple root, each cert must be signed by its parent and within validity,
// and the payload signature must verify against the leaf key.
async function verifyAndDecode(signedPayload: string): Promise<Record<string, unknown>> {
  const header = jose.decodeProtectedHeader(signedPayload);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 2) {
    throw new Error("missing_x5c_chain");
  }
  const certs = x5c.map((b64) => new X509Certificate(Buffer.from(b64, "base64")));
  const root = new X509Certificate(await appleRoot());

  if (!certs[certs.length - 1].raw.equals(root.raw)) {
    throw new Error("untrusted_root");
  }
  const now = Date.now();
  for (let i = 0; i < certs.length; i += 1) {
    const cert = certs[i];
    if (now < Date.parse(cert.validFrom) || now > Date.parse(cert.validTo)) {
      throw new Error("certificate_expired");
    }
    const issuer = i + 1 < certs.length ? certs[i + 1] : root;
    if (!cert.verify(issuer.publicKey)) {
      throw new Error("broken_certificate_chain");
    }
  }

  const leafPem = certs[0].toString();
  const key = await jose.importX509(leafPem, header.alg ?? "ES256");
  const { payload } = await jose.compactVerify(signedPayload, key);
  return JSON.parse(new TextDecoder().decode(payload));
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || !("signedPayload" in body) || typeof body.signedPayload !== "string") {
      throw new Error("missing_signed_payload");
    }
    const payload = await verifyAndDecode(body.signedPayload);
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const transaction = typeof data.signedTransactionInfo === "string"
      ? await verifyAndDecode(data.signedTransactionInfo)
      : payload;
    const supabase = serviceClient();
    const userId = transaction.appAccountToken as string | undefined;
    if (!userId) {
      return jsonResponse({ ok: true, ignored: "missing_app_account_token" });
    }
    const productId = (transaction.productId as string | undefined) ?? "unknown";
    const isSubscription = productId.includes("plus");
    const expiresAt = transaction.expiresDate ? new Date(Number(transaction.expiresDate)).toISOString() : null;
    await supabase.from("iap_receipts").upsert({
      user_id: userId,
      product_id: productId,
      transaction_id: transaction.transactionId,
      original_transaction_id: transaction.originalTransactionId,
      purchased_at: transaction.purchaseDate ? new Date(Number(transaction.purchaseDate)).toISOString() : new Date().toISOString(),
      expires_at: expiresAt,
      is_subscription: isSubscription,
      raw_payload: payload
    });
    // Only subscription events may change the tier — consumables must not.
    if (isSubscription) {
      const shouldDowngrade = ["EXPIRED", "REFUND", "REVOKE"].includes(payload.notificationType as string);
      await supabase
        .from("profiles")
        .update({
          subscription_tier: shouldDowngrade ? "free" : "plus",
          subscription_expires_at: shouldDowngrade ? null : expiresAt,
          premium_since: shouldDowngrade ? null : new Date().toISOString()
        })
        .eq("id", userId);
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
