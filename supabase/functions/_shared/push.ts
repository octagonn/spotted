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
  | "arrival_buzz"
  | "system_notice"
  | "post_comment"
  | "community_message";

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
  title?: string;
  body?: string;
  /** Stable per-notification seed for copy rotation (notification id). */
  seed?: string;
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
  if (type === "dm" || type === "community_message") return "messages";
  if (type === "daily_nudge" || type === "arrival_buzz") return "reminders";
  return "social";
}

/** Deterministic variant picker: same notification -> same line, rotates across notifications. */
function pick(seed: string | undefined, options: string[]): string {
  if (!seed) return options[0];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

/**
 * Push copy. Rule: the TITLE carries the hook (a name, a number, or a
 * consequence); the body adds a nudge or social proof. Friendly, second
 * person, short. Repeat types rotate 4-6 variants via `seed`.
 */
export function formatPushPayload(type: NotificationType, context: PushContext) {
  const actorName = context.actorName ?? "Someone";
  const gym = context.gymName ?? "the gym";
  const seed = context.seed;
  switch (type) {
    case "friend_request":
      return {
        title: `${actorName} wants to add you`,
        body: pick(seed, [
          "Accept and see each other's dailies.",
          "Gym buddies post more. Say yes?",
          "One tap to add them back.",
          "They found you. Add them back?",
          "Say hi and start a streak together."
        ])
      };
    case "friend_accepted":
      return {
        title: `You and ${actorName} are friends now`,
        body: pick(seed, [
          "Post today and see what they've been up to.",
          "Their dailies unlock once you post yours.",
          "Go say hi.",
          "Send a taunt to break the ice.",
          "Two more eyes on your posts."
        ])
      };
    case "post_view":
      return { title: `${actorName} saw your post`, body: "Eyes on you." };
    case "post_reaction":
      return context.reaction === "🔥"
        ? {
            title: `${actorName} liked your post 🔥`,
            body: pick(seed, [
              "Your post is getting eyes.",
              "People are watching. Post again tomorrow.",
              "Go see who else reacted.",
              "That one landed.",
              "Nice. Keep them coming."
            ])
          }
        : { title: `${actorName} reacted to your post`, body: context.reaction ? `${context.reaction} Go see it.` : "Go see it." };
    case "post_comment":
      return { title: `${actorName} commented on your post`, body: context.text ?? "Go see what they said." };
    case "streak_break_friend":
      return {
        title: `${actorName}'s streak ended`,
        body: pick(seed, [
          `${context.streakCount ?? 0} days. Send a taunt to get them back in.`,
          `${context.streakCount ?? 0} days. Nudge them back to the gym.`,
          "Everyone slips. A taunt might help."
        ])
      };
    case "streak_milestone":
      return {
        title: `${context.streakCount ?? 0}-day streak 🔥`,
        body: pick(seed, [
          "Most people stop before this. Keep going.",
          "You're on a roll.",
          "That's consistency. Keep stacking.",
          "Don't stop now.",
          "Proud of that one."
        ])
      };
    case "dm":
      return { title: actorName, body: context.messagePreview ?? "New message" };
    case "gym_arrival_friend":
      return {
        title: `${actorName} is at ${gym} right now`,
        body: pick(seed, ["Where are you?", "They showed up. Your turn?", "Go meet them there.", "Wave at them.", "Good time to head over."])
      };
    case "new_follower":
      return { title: `${actorName} started following you`, body: "Follow back?" };
    case "community_invite":
      return { title: `${actorName} invited you to ${context.communityName ?? "a community"}`, body: "Join the crew." };
    case "taunt":
      return { title: `${actorName} taunted you`, body: context.text ?? "Your move." };
    case "wave":
      return { title: `${actorName} waved at you`, body: context.gymName ? `They're at ${context.gymName}. Go say hi.` : "Your gym buddy is here." };
    case "community_nudge":
      return { title: `${context.communityName ?? "Your community"} is waiting`, body: context.text ?? `${actorName} says the crew is waiting on you.` };
    case "community_message":
      return { title: context.communityName ?? "Group chat", body: `${actorName}: ${context.text ?? "New message"}` };
    case "tagged":
      return { title: `${actorName} tagged you`, body: `You're in their ${context.kind === "story" ? "story" : "post"}. Go look.` };
    case "taunt_answered":
      return { title: `${actorName} took the bait`, body: pick(seed, ["They posted after your taunt. Respect.", "Your taunt worked. They posted.", "They answered. Go see it."]) };
    case "trophy_unlocked":
      return { title: "Trophy unlocked 🏆", body: context.trophyName ? `${context.trophyName} is in your case.` : "A new trophy is in your case." };
    case "claim_approved":
      return { title: `${context.trophyName ?? "Your lift"}: approved`, body: "Trophy unlocked. Go flex it." };
    case "claim_rejected":
      return { title: "Claim needs attention", body: context.reason ?? "We couldn't verify this claim" };
    case "second_workout":
      return { title: `${actorName} is going twice today`, body: `${context.workoutName ?? "Second session"}. Show-off.` };
    case "daily_nudge":
      return { title: context.title ?? "Your feed's locked", body: context.text ?? "One post unlocks everything." };
    case "arrival_buzz":
      return { title: context.title ?? "You made it in", body: context.text ?? "Get after it, then post your SPOTTED before you leave." };
    case "system_notice":
      return { title: context.title ?? "Spotted", body: context.body ?? context.text ?? "You have a new update" };
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
