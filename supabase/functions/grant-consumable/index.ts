import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

function parseBody(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "product_id" in body &&
    typeof body.product_id === "string" &&
    "transaction_id" in body &&
    typeof body.transaction_id === "string"
  ) {
    return { productId: body.product_id, transactionId: body.transaction_id };
  }
  throw new Error("invalid_body");
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const user = await authenticatedUser(request);
    const { productId, transactionId } = parseBody(await request.json());
    const supabase = serviceClient();
    const { data: grant, error } = await supabase
      .from("consumable_grants")
      .insert({ user_id: user.id, product_id: productId })
      .select("*")
      .single();
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    await supabase.from("iap_receipts").insert({
      user_id: user.id,
      product_id: productId,
      transaction_id: transactionId,
      purchased_at: new Date().toISOString(),
      is_subscription: false,
      raw_payload: { source: "client_consumable" }
    });
    if (productId.includes("streak_revival")) {
      await supabase.from("streaks").update({ current_streak: 1 }).eq("user_id", user.id);
    }
    return jsonResponse({ grant });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
