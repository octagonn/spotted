import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { formatPushPayload, sendApns } from "../_shared/push.ts";
import { serviceClient } from "../_shared/supabase.ts";

function notificationIdFromBody(body: unknown) {
  if (body && typeof body === "object" && "notification_id" in body && typeof body.notification_id === "string") {
    return body.notification_id;
  }
  throw new Error("invalid_notification_id");
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const notificationId = notificationIdFromBody(await request.json());
    const supabase = serviceClient();
    const { data: notification, error } = await supabase
      .from("notifications")
      .select("*, actor:actor_id(display_name), recipient:recipient_id(display_name)")
      .eq("id", notificationId)
      .single();
    if (error) {
      return jsonResponse({ error: error.message }, 404);
    }
    const { data: tokens, error: tokenError } = await supabase
      .from("device_tokens")
      .select("device_token")
      .eq("user_id", notification.recipient_id);
    if (tokenError) {
      return jsonResponse({ error: tokenError.message }, 500);
    }
    const payload = formatPushPayload(notification.type, {
      actorName: notification.actor?.display_name,
      gymName: notification.payload?.gymName,
      reaction: notification.payload?.reaction,
      messagePreview: notification.payload?.messagePreview,
      muscleGroup: notification.payload?.muscleGroup,
      streakCount: notification.payload?.streakCount
    });
    await Promise.all(tokens.map((token) => sendApns(token.device_token, { ...payload, data: { notification_id: notificationId } })));
    return jsonResponse({ sent: tokens.length });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
