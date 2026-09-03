import type { AppNotification } from "@/hooks/queries/useNotifications";
import { localDateKey } from "@/lib/dateKey";

/** "3m" / "5h" / "2d" relative label. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const mins = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}

/** Copy that follows the actor's name for a single notification. */
export function notificationText(n: AppNotification): string {
  switch (n.type) {
    case "friend_accepted":
      return "accepted your friend request";
    case "post_reaction":
      // Heart-likes store the 🔥 like emoji in the payload; live-reaction
      // selfies store null — split the copy so likes read as likes.
      return n.payload?.reaction === "🔥" ? "liked your post" : "reacted to your post";
    case "post_comment":
      return "commented on your post";
    case "mention":
      return "mentioned you in a comment";
    case "dm":
      return "sent you a message";
    case "gym_arrival_friend":
      return "just checked in at the gym";
    case "streak_break_friend":
      return "'s streak ended";
    case "streak_milestone":
      return "hit a streak milestone";
    case "trophy_unlocked":
      return `unlocked ${String(n.payload?.name ?? "a trophy")} 🏆`;
    case "taunt":
      return `roasted you: "${String(n.payload?.text ?? "…")}"`;
    case "community_invite":
      return `invited you to ${String(n.payload?.community_name ?? "a community")}`;
    case "wave":
      return n.payload?.gymName ? `waved at you — they're at ${String(n.payload.gymName)}` : "waved at you";
    case "community_nudge":
      return n.payload?.text
        ? `nudged ${String(n.payload?.communityName ?? "your crew")}: "${String(n.payload.text)}"`
        : `nudged ${String(n.payload?.communityName ?? "your crew")} — it's been quiet`;
    case "tagged":
      return `tagged you in their ${n.payload?.kind === "story" ? "story" : "post"}`;
    case "second_workout":
      return `put in a second workout today — ${String(n.payload?.workout_name ?? "another session")}`;
    case "taunt_answered":
      return "answered your taunt — they posted";
    case "claim_approved":
      return `approved your ${String(n.payload?.trophy_id ?? "lift")} claim — trophy unlocked`;
    case "claim_rejected":
      return `rejected your ${String(n.payload?.trophy_id ?? "lift")} claim: ${String(n.payload?.reason ?? "not verifiable")}`;
    case "system_notice":
      return String(n.payload?.body ?? n.payload?.title ?? "posted an update");
    default:
      return "sent you an update";
  }
}

/** Types that stack per actor ("X sent you 4 messages") instead of one row each. */
export const MERGEABLE = new Set([
  "dm",
  "post_reaction",
  "post_comment",
  "mention",
  "tagged",
  "taunt",
  "wave",
  "gym_arrival_friend",
  "second_workout"
]);

/**
 * Collapse a bucket so one actor + one type = one row (newest first). The
 * merged row keeps the newest notification's id/route/thumb, is unread if any
 * member is, and carries `count` for the copy.
 */
export function mergeByActor(rows: AppNotification[]): AppNotification[] {
  const out: AppNotification[] = [];
  const index = new Map<string, number>();
  for (const n of rows) {
    if (!n.actorId || !MERGEABLE.has(n.type)) {
      out.push(n);
      continue;
    }
    const key = `${n.actorId}|${n.type}`;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, out.length);
      out.push({ ...n, count: 1, mergedIds: [n.id] });
    } else {
      const head = out[at];
      out[at] = {
        ...head,
        count: (head.count ?? 1) + 1,
        read: head.read && n.read,
        mergedIds: [...(head.mergedIds ?? []), n.id]
      };
    }
  }
  return out;
}

/** Copy for a merged row; falls back to the single-row copy when count is 1. */
export function mergedNotificationText(n: AppNotification): string {
  const c = n.count ?? 1;
  if (c <= 1) return notificationText(n);
  switch (n.type) {
    case "dm":
      return `sent you ${c} messages`;
    case "post_reaction":
      return `reacted to ${c} of your posts`;
    case "post_comment":
      return `left ${c} comments on your posts`;
    case "mention":
      return `mentioned you in ${c} comments`;
    case "tagged":
      return `tagged you in ${c} posts`;
    case "taunt":
      return `roasted you ${c} times`;
    case "wave":
      return `waved at you ${c} times`;
    case "gym_arrival_friend":
      return `checked in at the gym ${c} times`;
    case "second_workout":
      return `logged ${c} extra workouts`;
    default:
      return `${notificationText(n)} (${c})`;
  }
}

export type NotificationGroup = { label: "Today" | "Yesterday" | "Last week"; rows: AppNotification[] };

/** Bucket notifications by recency; drops anything older than a week. */
export function groupNotifications(activity: AppNotification[], now: Date = new Date()): NotificationGroup[] {
  const todayKey = localDateKey(now);
  const yesterdayKey = localDateKey(new Date(now.getTime() - 86_400_000));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const lastWeek: AppNotification[] = [];
  for (const n of activity) {
    const t = new Date(n.createdAt);
    if (t.getTime() < weekAgo) continue;
    const key = localDateKey(t);
    if (key === todayKey) today.push(n);
    else if (key === yesterdayKey) yesterday.push(n);
    else lastWeek.push(n);
  }
  return [
    { label: "Today", rows: mergeByActor(today) },
    { label: "Yesterday", rows: mergeByActor(yesterday) },
    { label: "Last week", rows: mergeByActor(lastWeek) }
  ];
}
