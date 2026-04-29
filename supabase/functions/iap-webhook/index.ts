import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

function decodePayload(signedPayload: string) {
  const parts = signedPayload.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_jws");
  }
  const json = atob(parts[1].replaceAll("-", "+").replaceAll("_", "/"));
  return JSON.parse(json);
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
    const payload = decodePayload(body.signedPayload);
    const data = payload.data ?? {};
    const transaction = data.signedTransactionInfo ? decodePayload(data.signedTransactionInfo) : payload;
    const supabase = serviceClient();
    const userId = transaction.appAccountToken;
    if (!userId) {
      return jsonResponse({ ok: true, ignored: "missing_app_account_token" });
    }
    const productId = transaction.productId ?? "unknown";
    const expiresAt = transaction.expiresDate ? new Date(Number(transaction.expiresDate)).toISOString() : null;
    await supabase.from("iap_receipts").upsert({
      user_id: userId,
      product_id: productId,
      transaction_id: transaction.transactionId,
      original_transaction_id: transaction.originalTransactionId,
      purchased_at: transaction.purchaseDate ? new Date(Number(transaction.purchaseDate)).toISOString() : new Date().toISOString(),
      expires_at: expiresAt,
      is_subscription: productId.includes("plus"),
      raw_payload: payload
    });
    const shouldDowngrade = ["EXPIRED", "REFUND", "REVOKE"].includes(payload.notificationType);
    await supabase
      .from("profiles")
      .update({
        subscription_tier: shouldDowngrade ? "free" : "plus",
        subscription_expires_at: shouldDowngrade ? null : expiresAt,
        premium_since: shouldDowngrade ? null : new Date().toISOString()
      })
      .eq("id", userId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
