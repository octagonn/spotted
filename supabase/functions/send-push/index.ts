import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import {
  channelForType,
  formatPushPayload,
  getExpoReceipts,
  isExpoPushToken,
  sendExpoMessages,
  type ExpoMessage,
  type NotificationType,
  type PushContext
} from "../_shared/push.ts";
import { serviceClient } from "../_shared/supabase.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-z0-9_]{3,20}$/;
const RETRYABLE_EXPO_ERRORS = new Set(["MessageRateExceeded", "ServiceUnavailable", "InternalError"]);

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  push_status: string;
  push_attempts: number;
  push_processed_at: string | null;
  actor: { display_name: string; username: string } | null;
};

type PreferenceRow = {
  push_enabled: boolean;
  gym_reminders_enabled: boolean;
  taunts_enabled: boolean;
  friend_checkins_scope: "my_gym" | "all_friends" | "off";
  messages_enabled: boolean;
  friend_requests_enabled: boolean;
  reactions_enabled: boolean;
  post_views_enabled: boolean;
  follows_enabled: boolean;
  tags_enabled: boolean;
  communities_enabled: boolean;
  friend_activity_enabled: boolean;
  achievements_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
};

type RequestBody =
  | { notification_id: string }
  | { mode: "retry" | "receipts"; bucket: string };

function requestAction(body: RequestBody) {
  if ("notification_id" in body) {
    if (!UUID.test(body.notification_id)) throw new Error("invalid_notification_id");
    return `notification:${body.notification_id}`;
  }
  if (!/^\d{12}$/.test(body.bucket)) throw new Error("invalid_bucket");
  return `${body.mode}:${body.bucket}`;
}

async function authenticateWebhook(
  supabase: ReturnType<typeof serviceClient>,
  request: Request,
  body: RequestBody
) {
  const signature = request.headers.get("x-spotted-push-signature") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const { data, error } = await supabase.rpc("validate_push_webhook", {
    p_action: requestAction(body),
    p_signature: signature
  });
  return !error && data === true;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function contextFromNotification(notification: NotificationRow, gymName?: string): PushContext {
  const payload = notification.payload ?? {};
  return {
    actorName: notification.actor?.display_name,
    gymName: gymName ?? stringValue(payload.gymName),
    reaction: stringValue(payload.reaction),
    messagePreview: stringValue(payload.messagePreview),
    muscleGroup: stringValue(payload.muscleGroup),
    streakCount: numberValue(payload.streakCount),
    communityName: stringValue(payload.communityName) ?? stringValue(payload.community_name),
    text: stringValue(payload.text),
    trophyName:
      stringValue(payload.trophyName) ??
      stringValue(payload.trophy_name) ??
      stringValue(payload.trophy_id),
    workoutName: stringValue(payload.workout_name),
    reason: stringValue(payload.reason),
    kind: stringValue(payload.kind)
  };
}

function uuidValue(value: unknown) {
  const result = stringValue(value);
  return result && UUID.test(result) ? result : undefined;
}

function routeForNotification(notification: NotificationRow) {
  const payload = notification.payload ?? {};
  const postId = uuidValue(payload.post_id) ?? uuidValue(payload.postId);
  const communityId = uuidValue(payload.community_id) ?? uuidValue(payload.communityId);
  const actorUsername =
    notification.actor?.username && USERNAME.test(notification.actor.username)
      ? notification.actor.username
      : undefined;
  switch (notification.type) {
    case "dm":
      return notification.actor_id ? `/chat/${notification.actor_id}` : "/inbox";
    case "post_view":
    case "post_reaction":
    case "taunt_answered":
    case "second_workout":
      return postId ? `/post/${postId}` : "/inbox";
    case "tagged":
      if (postId) return `/post/${postId}`;
      return actorUsername ? `/story?user=${actorUsername}` : "/inbox";
    case "community_invite":
    case "community_nudge":
      return communityId ? `/community/${communityId}` : "/inbox";
    case "streak_milestone":
    case "trophy_unlocked":
    case "claim_approved":
    case "claim_rejected":
      return "/profile-section/trophies";
    case "daily_nudge":
    case "arrival_buzz":
      return "/(tabs)/feed";
    default:
      return actorUsername ? `/user/${actorUsername}` : "/inbox";
  }
}

function timeMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function localMinutes(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  }
}

function isQuietHours(preferences: PreferenceRow) {
  if (!preferences.quiet_hours_enabled) return false;
  const start = timeMinutes(preferences.quiet_hours_start);
  const end = timeMinutes(preferences.quiet_hours_end);
  if (start === end) return false;
  const now = localMinutes(preferences.timezone);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function preferenceAllows(type: NotificationType, preferences: PreferenceRow) {
  if (!preferences.push_enabled) return "push_disabled";
  if (isQuietHours(preferences)) return "quiet_hours";
  switch (type) {
    case "daily_nudge":
    case "arrival_buzz":
      return preferences.gym_reminders_enabled ? null : "gym_reminders_disabled";
    case "gym_arrival_friend":
      return preferences.friend_checkins_scope !== "off" ? null : "friend_checkins_disabled";
    case "taunt":
    case "taunt_answered":
      return preferences.taunts_enabled ? null : "taunts_disabled";
    case "dm":
      return preferences.messages_enabled ? null : "messages_disabled";
    case "friend_request":
    case "friend_accepted":
      return preferences.friend_requests_enabled ? null : "friend_requests_disabled";
    case "post_reaction":
      return preferences.reactions_enabled ? null : "reactions_disabled";
    case "post_view":
      return preferences.post_views_enabled ? null : "post_views_disabled";
    case "new_follower":
      return preferences.follows_enabled ? null : "follows_disabled";
    case "tagged":
      return preferences.tags_enabled ? null : "tags_disabled";
    case "community_invite":
    case "community_nudge":
      return preferences.communities_enabled ? null : "communities_disabled";
    case "wave":
    case "streak_break_friend":
    case "second_workout":
      return preferences.friend_activity_enabled ? null : "friend_activity_disabled";
    case "streak_milestone":
    case "trophy_unlocked":
    case "claim_approved":
    case "claim_rejected":
      return preferences.achievements_enabled ? null : "achievements_disabled";
  }
}

function notificationTtl(type: NotificationType) {
  if (type === "daily_nudge" || type === "arrival_buzz") return 4 * 60 * 60;
  if (type === "gym_arrival_friend" || type === "wave") return 2 * 60 * 60;
  if (type === "dm") return 7 * 24 * 60 * 60;
  return 24 * 60 * 60;
}

function retryAt(attempts: number) {
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function updateNotification(
  supabase: ReturnType<typeof serviceClient>,
  id: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase.from("notifications").update(patch).eq("id", id);
  if (error) throw error;
}

async function processNotification(
  supabase: ReturnType<typeof serviceClient>,
  notificationId: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, recipient_id, actor_id, type, payload, push_status, push_attempts, push_processed_at, actor:actor_id(display_name, username)"
    )
    .eq("id", notificationId)
    .single();
  if (error || !data) return { id: notificationId, status: "not_found" };
  const notification = data as unknown as NotificationRow;

  if (["ticketed", "delivered", "suppressed", "no_token", "failed"].includes(notification.push_status)) {
    return { id: notificationId, status: notification.push_status };
  }
  if (
    notification.push_status === "processing" &&
    notification.push_processed_at &&
    Date.now() - new Date(notification.push_processed_at).getTime() < 5 * 60_000
  ) {
    return { id: notificationId, status: "already_processing" };
  }

  const attempts = (notification.push_attempts ?? 0) + 1;
  await updateNotification(supabase, notification.id, {
    push_status: "processing",
    push_attempts: attempts,
    push_processed_at: new Date().toISOString(),
    push_last_error: null
  });

  const { data: blocked } = notification.actor_id
    ? await supabase
        .from("user_blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${notification.recipient_id},blocked_id.eq.${notification.actor_id}),and(blocker_id.eq.${notification.actor_id},blocked_id.eq.${notification.recipient_id})`
        )
        .limit(1)
        .maybeSingle()
    : { data: null };
  if (blocked) {
    await updateNotification(supabase, notification.id, {
      push_status: "suppressed",
      push_last_error: "blocked_relationship"
    });
    return { id: notificationId, status: "suppressed", reason: "blocked_relationship" };
  }

  let { data: preferences } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", notification.recipient_id)
    .maybeSingle();
  if (!preferences) {
    const result = await supabase
      .from("notification_preferences")
      .upsert({ user_id: notification.recipient_id }, { onConflict: "user_id" })
      .select("*")
      .single();
    preferences = result.data;
  }
  if (!preferences) throw new Error("notification_preferences_unavailable");

  const suppressionReason = preferenceAllows(notification.type, preferences as PreferenceRow);
  if (suppressionReason) {
    await updateNotification(supabase, notification.id, {
      push_status: "suppressed",
      push_last_error: suppressionReason
    });
    return { id: notificationId, status: "suppressed", reason: suppressionReason };
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from("device_tokens")
    .select("device_token")
    .eq("user_id", notification.recipient_id)
    .eq("provider", "expo");
  if (tokenError) throw tokenError;
  const tokens = (tokenRows ?? [])
    .map((row) => row.device_token as string)
    .filter(isExpoPushToken);
  if (tokens.length === 0) {
    await updateNotification(supabase, notification.id, {
      push_status: "no_token",
      push_last_error: "no_registered_device"
    });
    return { id: notificationId, status: "no_token" };
  }

  const payload = notification.payload ?? {};
  const gymId = uuidValue(payload.gym_id);
  let gymName: string | undefined;
  if (gymId) {
    const { data: gym } = await supabase.from("gyms").select("name").eq("id", gymId).maybeSingle();
    gymName = gym?.name;
  }

  const [{ count: unreadCount }, existingDeliveries] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", notification.recipient_id)
      .eq("read", false)
      .not("type", "in", "(post_view,daily_nudge,arrival_buzz)"),
    supabase
      .from("push_deliveries")
      .select("device_token, status")
      .eq("notification_id", notification.id)
  ]);
  const alreadySent = new Set(
    (existingDeliveries.data ?? [])
      .filter((delivery) => ["ticketed", "delivered"].includes(delivery.status))
      .map((delivery) => delivery.device_token as string)
  );
  const sendTokens = tokens.filter((token) => !alreadySent.has(token));
  if (sendTokens.length === 0) {
    await updateNotification(supabase, notification.id, { push_status: "ticketed" });
    return { id: notificationId, status: "ticketed", sent: 0 };
  }

  await supabase.from("push_deliveries").upsert(
    sendTokens.map((token) => ({
      notification_id: notification.id,
      user_id: notification.recipient_id,
      device_token: token,
      status: "sending",
      attempts,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "notification_id,device_token" }
  );

  const formatted = formatPushPayload(
    notification.type,
    contextFromNotification(notification, gymName)
  );
  const route = routeForNotification(notification);
  const messages: ExpoMessage[] = sendTokens.map((token) => ({
    to: token,
    title: formatted.title,
    body: formatted.body,
    data: {
      notification_id: notification.id,
      type: notification.type,
      actor_id: notification.actor_id,
      actor_username: notification.actor?.username ?? null,
      url: route
    },
    sound: "default",
    badge: Math.max(0, unreadCount ?? 0),
    channelId: channelForType(notification.type),
    priority: notification.type === "dm" ? "high" : "default",
    ttl: notificationTtl(notification.type)
  }));

  try {
    const tickets = await sendExpoMessages(messages);
    let accepted = 0;
    let retryable = 0;
    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      const token = sendTokens[index];
      if (ticket.status === "ok") {
        accepted += 1;
        await supabase
          .from("push_deliveries")
          .update({
            status: "ticketed",
            ticket_id: ticket.id,
            sent_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString()
          })
          .eq("notification_id", notification.id)
          .eq("device_token", token);
      } else {
        const code = ticket.details?.error ?? "ExpoTicketError";
        const canRetry = RETRYABLE_EXPO_ERRORS.has(code);
        if (canRetry) retryable += 1;
        await supabase
          .from("push_deliveries")
          .update({
            status: canRetry ? "retry" : "failed",
            last_error: `${code}:${ticket.message}`.slice(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq("notification_id", notification.id)
          .eq("device_token", token);
        if (code === "DeviceNotRegistered") {
          await supabase.from("device_tokens").delete().eq("device_token", token);
        }
      }
    }

    const nextStatus = accepted > 0 ? "ticketed" : retryable > 0 && attempts < 5 ? "retry" : "failed";
    await updateNotification(supabase, notification.id, {
      push_status: nextStatus,
      push_next_attempt_at: nextStatus === "retry" ? retryAt(attempts) : null,
      push_last_error: nextStatus === "failed" ? "all_expo_tickets_failed" : null
    });
    return { id: notificationId, status: nextStatus, sent: accepted };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = attempts < 5 ? "retry" : "failed";
    await supabase
      .from("push_deliveries")
      .update({
        status: nextStatus,
        last_error: message.slice(0, 500),
        updated_at: new Date().toISOString()
      })
      .eq("notification_id", notification.id)
      .eq("status", "sending");
    await updateNotification(supabase, notification.id, {
      push_status: nextStatus,
      push_next_attempt_at: nextStatus === "retry" ? retryAt(attempts) : null,
      push_last_error: message.slice(0, 500)
    });
    return { id: notificationId, status: nextStatus, error: message };
  }
}

async function retryPending(supabase: ReturnType<typeof serviceClient>) {
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  await supabase
    .from("notifications")
    .update({
      push_status: "retry",
      push_next_attempt_at: new Date().toISOString(),
      push_last_error: "stale_processing_recovered"
    })
    .eq("push_status", "processing")
    .lt("push_processed_at", stale);

  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .in("push_status", ["pending", "retry"])
    .lte("push_next_attempt_at", new Date().toISOString())
    .lt("push_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  const results = [];
  for (const row of data ?? []) {
    results.push(await processNotification(supabase, row.id));
  }
  return results;
}

async function refreshNotificationDeliveryState(
  supabase: ReturnType<typeof serviceClient>,
  notificationId: string
) {
  const { data } = await supabase
    .from("push_deliveries")
    .select("status")
    .eq("notification_id", notificationId);
  const states = (data ?? []).map((row) => row.status as string);
  if (states.includes("delivered")) {
    await updateNotification(supabase, notificationId, { push_status: "delivered" });
  } else if (states.length > 0 && states.every((state) => ["failed", "expired"].includes(state))) {
    await updateNotification(supabase, notificationId, {
      push_status: "failed",
      push_last_error: "all_delivery_receipts_failed"
    });
  }
}

async function checkReceipts(supabase: ReturnType<typeof serviceClient>) {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: deliveries, error } = await supabase
    .from("push_deliveries")
    .select("id, notification_id, device_token, ticket_id, sent_at")
    .eq("status", "ticketed")
    .not("ticket_id", "is", null)
    .lte("sent_at", cutoff)
    .order("sent_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  if (!deliveries?.length) return { checked: 0 };

  const ids = deliveries.map((delivery) => delivery.ticket_id as string);
  const receipts = await getExpoReceipts(ids);
  const touched = new Set<string>();
  let checked = 0;
  for (const delivery of deliveries) {
    const receipt = receipts[delivery.ticket_id as string];
    if (!receipt) {
      if (Date.now() - new Date(delivery.sent_at).getTime() > 24 * 60 * 60_000) {
        await supabase
          .from("push_deliveries")
          .update({
            status: "expired",
            last_error: "receipt_not_available_within_24h",
            receipt_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", delivery.id);
        touched.add(delivery.notification_id);
      }
      continue;
    }

    checked += 1;
    touched.add(delivery.notification_id);
    if (receipt.status === "ok") {
      await supabase
        .from("push_deliveries")
        .update({
          status: "delivered",
          receipt_checked_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", delivery.id);
    } else {
      const code = receipt.details?.error ?? "ExpoReceiptError";
      await supabase
        .from("push_deliveries")
        .update({
          status: "failed",
          receipt_checked_at: new Date().toISOString(),
          last_error: `${code}:${receipt.message}`.slice(0, 500),
          updated_at: new Date().toISOString()
        })
        .eq("id", delivery.id);
      if (code === "DeviceNotRegistered") {
        await supabase.from("device_tokens").delete().eq("device_token", delivery.device_token);
      }
    }
  }

  for (const notificationId of touched) {
    await refreshNotificationDeliveryState(supabase, notificationId);
  }
  return { checked, pending: deliveries.length - checked };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = (await request.json()) as RequestBody;
    const supabase = serviceClient();
    if (!(await authenticateWebhook(supabase, request, body))) {
      return jsonResponse({ error: "invalid_push_webhook_signature" }, 401);
    }

    if ("notification_id" in body) {
      return jsonResponse(await processNotification(supabase, body.notification_id));
    }
    if (body.mode === "retry") {
      const results = await retryPending(supabase);
      return jsonResponse({ processed: results.length, results });
    }
    return jsonResponse(await checkReceipts(supabase));
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "unknown_error" },
      400
    );
  }
});
