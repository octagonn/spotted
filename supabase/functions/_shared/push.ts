export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "post_view"
  | "post_reaction"
  | "streak_break_friend"
  | "streak_milestone"
  | "dm"
  | "gym_arrival_friend"
  | "new_follower"
  | "community_invite"
  | "taunt"
  | "wave"
  | "community_nudge"
  | "tagged"
  | "taunt_answered"
  | "trophy_unlocked"
  | "claim_approved"
  | "claim_rejected"
  | "second_workout"
  | "daily_nudge"
  | "arrival_buzz";

export type PushContext = {
  actorName?: string;
  gymName?: string;
  reaction?: string;
  messagePreview?: string;
  muscleGroup?: string;
  streakCount?: number;
  communityName?: string;
  text?: string;
  trophyName?: string;
  workoutName?: string;
  reason?: string;
  kind?: string;
};

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  badge: number;
  channelId: "social" | "messages" | "reminders";
  priority: "default" | "high";
  ttl: number;
};

export type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

export type ExpoReceipt =
  | { status: "ok"; details?: Record<string, unknown> }
  | { status: "error"; message: string; details?: { error?: string } };

export function isExpoPushToken(token: string) {
  return /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token);
}
export function channelForType(type: NotificationType): ExpoMessage["channelId"] {
  if (type === "dm") return "messages";
  if (type === "daily_nudge" || type === "arrival_buzz") return "reminders";
  return "social";
}

export function formatPushPayload(type: NotificationType, context: PushContext) {
  const actorName = context.actorName ?? "Someone";
  switch (type) {
    case "friend_request":
      return { title: "New friend request", body: `${actorName} wants to add you` };
    case "friend_accepted":
      return { title: "Friend added", body: `You and ${actorName} are now friends` };
    case "post_view":
      return { title: "Eyes on you", body: `${actorName} viewed your post` };
    case "post_reaction":
      return { title: context.reaction ?? "New reaction", body: `${actorName} reacted to your post` };
    case "streak_break_friend":
      return {
        title: "Streak broken",
        body: `${actorName} skipped ${context.muscleGroup ?? "training"} day. Streak ended at ${context.streakCount ?? 0}.`
      };
    case "streak_milestone":
      return { title: `${context.streakCount ?? 0}-day streak`, body: "Don't break it now." };
    case "dm":
      return { title: actorName, body: context.messagePreview ?? "New message" };
    case "gym_arrival_friend":
      return { title: "At the gym", body: `${actorName} just got to ${context.gymName ?? "the gym"}` };
    case "new_follower":
      return { title: "New follower", body: `${actorName} started following you` };
    case "community_invite":
      return {
        title: "Community invite",
        body: `${actorName} invited you to ${context.communityName ?? "a community"}`
      };
    case "taunt":
      return { title: `${actorName} taunted you`, body: context.text ?? "Your move." };
    case "wave":
      return {
        title: `${actorName} waved`,
        body: context.gymName ? `They're at ${context.gymName}` : "Your gym buddy is here"
      };
    case "community_nudge":
      return {
        title: context.communityName ?? "Your community",
        body: context.text ?? `${actorName} says the crew is waiting`
      };
    case "tagged":
      return {
        title: "You were tagged",
        body: `${actorName} tagged you in a ${context.kind === "story" ? "story" : "post"}`
      };
    case "taunt_answered":
      return { title: "Taunt answered", body: `${actorName} posted after your taunt` };
    case "trophy_unlocked":
      return { title: "Trophy unlocked", body: context.trophyName ?? "A new trophy is in your case" };
    case "claim_approved":
      return { title: "Claim approved", body: `${context.trophyName ?? "Your trophy"} is unlocked` };
    case "claim_rejected":
      return { title: "Claim needs attention", body: context.reason ?? "We couldn't verify this claim" };
    case "second_workout":
      return {
        title: `${actorName} is back for more`,
        body: context.workoutName ?? "Second workout of the day"
      };
    case "daily_nudge":
      return { title: "Spotted", body: context.text ?? "Your daily post is waiting" };
    case "arrival_buzz":
      return { title: "You're at the gym", body: context.text ?? "Check in and start your workout" };
  }
}

function expoHeaders() {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json"
  };
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function expoRequest<T>(url: string, body: unknown): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify(body)
      });
      const responseBody = await response.text();
      if (!response.ok) {
        const error = new Error(`expo_http_${response.status}:${responseBody.slice(0, 240)}`);
        if (response.status === 429 || response.status >= 500) {
          lastError = error;
          continue;
        }
        throw error;
      }
      return JSON.parse(responseBody) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("expo_request_failed");
}

export async function sendExpoMessages(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];
  if (messages.length > 100) throw new Error("expo_batch_too_large");
  const response = await expoRequest<{ data: ExpoTicket[] }>(
    "https://exp.host/--/api/v2/push/send",
    messages
  );
  if (!Array.isArray(response.data) || response.data.length !== messages.length) {
    throw new Error("invalid_expo_ticket_response");
  }
  return response.data;
}

export async function getExpoReceipts(ids: string[]): Promise<Record<string, ExpoReceipt>> {
  if (ids.length === 0) return {};
  if (ids.length > 1000) throw new Error("expo_receipt_batch_too_large");
  const response = await expoRequest<{ data: Record<string, ExpoReceipt> }>(
    "https://exp.host/--/api/v2/push/getReceipts",
    { ids }
  );
  return response.data ?? {};
}
