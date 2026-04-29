import type { Database, Json } from "@/types/database";

type NotificationType = Database["public"]["Enums"]["notification_type"];

export type PushContext = {
  actorName?: string;
  gymName?: string;
  reaction?: string;
  messagePreview?: string;
  muscleGroup?: string;
  streakCount?: number;
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
    return { title: "Eyes on you", body: `${actorName} viewed your pump drop` };
  }
  if (type === "post_reaction") {
    return { title: context.reaction ?? "Reaction", body: `${actorName} reacted to your drop` };
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
  return { title: "At the gym", body: `${actorName} just got to ${context.gymName ?? "the gym"}` };
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
  return { actorName, gymName, reaction, messagePreview, muscleGroup, streakCount };
}
