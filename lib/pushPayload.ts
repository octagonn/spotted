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
};

export function formatPushPayload(type: NotificationType, context: PushContext) {
  const actorName = context.actorName ?? "Someone";
  if (type === "friend_request") {
    return { title: "New friend request", body: `${actorName} wants to add you` };
  }
  if (type === "friend_accepted") {
    return { title: "Friend added", body: `You and ${actorName} are now friends` };
  }
  if (type === "post_view") {
    return { title: "Eyes on you", body: `${actorName} viewed your post` };
  }
  if (type === "post_reaction") {
    return { title: context.reaction ?? "Reaction", body: `${actorName} reacted to your post` };
  }
  if (type === "streak_break_friend") {
    return {
      title: "Streak broken",
      body: `${actorName} skipped ${context.muscleGroup ?? "training"} day. Streak ended at ${
        context.streakCount ?? 0
      }.`
    };
  }
  if (type === "streak_milestone") {
    return { title: `${context.streakCount ?? 0}-day streak`, body: "Don't break it now." };
  }
  if (type === "dm") {
    return { title: actorName, body: context.messagePreview ?? "New message" };
  }
  if (type === "gym_arrival_friend") {
    return { title: "At the gym", body: `${actorName} just got to ${context.gymName ?? "the gym"}` };
  }
  if (type === "new_follower") {
    return { title: "New follower", body: `${actorName} started following you` };
  }
  if (type === "community_invite") {
    return {
      title: "Community invite",
      body: `${actorName} invited you to ${context.communityName ?? "a community"}`
    };
  }
  if (type === "taunt") {
    return { title: `${actorName} taunted you`, body: context.text ?? "Your move." };
  }
  if (type === "wave") {
    return {
      title: `${actorName} waved`,
      body: context.gymName ? `They're at ${context.gymName}` : "Your gym buddy is here"
    };
  }
  if (type === "community_nudge") {
    return {
      title: context.communityName ?? "Your community",
      body: context.text ?? `${actorName} says the crew is waiting`
    };
  }
  if (type === "tagged") {
    return {
      title: "You were tagged",
      body: `${actorName} tagged you in a ${context.kind === "story" ? "story" : "post"}`
    };
  }
  if (type === "taunt_answered") {
    return { title: "Taunt answered", body: `${actorName} posted after your taunt` };
  }
  if (type === "trophy_unlocked") {
    return { title: "Trophy unlocked", body: context.trophyName ?? "A new trophy is in your case" };
  }
  if (type === "claim_approved") {
    return { title: "Claim approved", body: `${context.trophyName ?? "Your trophy"} is unlocked` };
  }
  if (type === "claim_rejected") {
    return { title: "Claim needs attention", body: context.reason ?? "We couldn't verify this claim" };
  }
  if (type === "second_workout") {
    return {
      title: `${actorName} is back for more`,
      body: context.workoutName ?? "Second workout of the day"
    };
  }
  if (type === "daily_nudge") {
    return { title: "Spotted", body: context.text ?? "Your daily post is waiting" };
  }
  if (type === "arrival_buzz") {
    return { title: "You're at the gym", body: context.text ?? "Check in and start your workout" };
  }
  return { title: "Spotted", body: "You have a new update" };
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
    kind
  };
}
