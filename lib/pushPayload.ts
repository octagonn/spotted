import type { Database, Json } from "@/types/database";

type NotificationType = Database["public"]["Enums"]["notification_type"];

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
};

/**
 * Client mirror of supabase/functions/_shared/push.ts (first variant only -
 * rotation lives on the server). Keep the two in sync.
 */
function pick(_seed: string | undefined, options: string[]): string {
  return options[0];
}

/**
 * Push copy. Rule: the TITLE carries the hook (a name, a number, or a
 * consequence); the body adds a nudge or social proof. Friendly, second
 * person, short. Repeat types rotate 4-6 variants via `seed`.
 */
export function formatPushPayload(type: NotificationType, context: PushContext) {
  const actorName = context.actorName ?? "Someone";
  const gym = context.gymName ?? "the gym";
  const seed = undefined;
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
    case "mention":
      return { title: `${actorName} mentioned you`, body: context.text ?? "Go see the comment." };
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

export function payloadToContext(payload: Json): PushContext {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const actorName = typeof payload.actorName === "string" ? payload.actorName : undefined;
  const gymName = typeof payload.gymName === "string" ? payload.gymName : undefined;
  const reaction = typeof payload.reaction === "string" ? payload.reaction : undefined;
  const messagePreview = typeof payload.messagePreview === "string" ? payload.messagePreview : undefined;
  const muscleGroup = typeof payload.muscleGroup === "string" ? payload.muscleGroup : undefined;
  const streakCount = typeof payload.streakCount === "number" ? payload.streakCount : undefined;
  const communityName =
    typeof payload.communityName === "string"
      ? payload.communityName
      : typeof payload.community_name === "string"
        ? payload.community_name
        : undefined;
  const text = typeof payload.text === "string" ? payload.text : undefined;
  const trophyName =
    typeof payload.trophyName === "string"
      ? payload.trophyName
      : typeof payload.trophy_id === "string"
        ? payload.trophy_id
        : undefined;
  const workoutName = typeof payload.workout_name === "string" ? payload.workout_name : undefined;
  const reason = typeof payload.reason === "string" ? payload.reason : undefined;
  const kind = typeof payload.kind === "string" ? payload.kind : undefined;
  const title = typeof payload.title === "string" ? payload.title : undefined;
  const body = typeof payload.body === "string" ? payload.body : undefined;
  return {
    actorName,
    gymName,
    reaction,
    messagePreview,
    muscleGroup,
    streakCount,
    communityName,
    text,
    trophyName,
    workoutName,
    reason,
    kind,
    title,
    body
  };
}
