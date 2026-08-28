import { describe, expect, it } from "vitest";

import { formatPushPayload } from "@/lib/pushPayload";
import type { Database } from "@/types/database";

type NotificationType = Database["public"]["Enums"]["notification_type"];

const ALL_TYPES: NotificationType[] = [
  "friend_request",
  "friend_accepted",
  "post_view",
  "post_reaction",
  "streak_break_friend",
  "streak_milestone",
  "dm",
  "gym_arrival_friend",
  "new_follower",
  "community_invite",
  "taunt",
  "wave",
  "community_nudge",
  "tagged",
  "taunt_answered",
  "trophy_unlocked",
  "claim_approved",
  "claim_rejected",
  "second_workout",
  "daily_nudge",
  "arrival_buzz",
  "post_comment",
  "system_notice"
];

describe("push payload formatting", () => {
  it("formats post views", () => {
    expect(formatPushPayload("post_view", { actorName: "Mia" })).toEqual({
      title: "Mia saw your post",
      body: "Eyes on you."
    });
  });

  it("formats streak breaks without leaking timestamps", () => {
    expect(
      formatPushPayload("streak_break_friend", { actorName: "Octavio", muscleGroup: "leg", streakCount: 14 })
    ).toEqual({
      title: "Octavio's streak ended",
      body: "14 days. Send a taunt to get them back in."
    });
  });

  it("formats every database notification type without a generic fallback", () => {
    for (const type of ALL_TYPES) {
      const payload = formatPushPayload(type, {
        actorName: "Mia",
        text: "Leg day",
        communityName: "Iron Club",
        trophyName: "Century",
        workoutName: "Push",
        kind: "story"
      });
      expect(payload.title.length, type).toBeGreaterThan(0);
      expect(payload.body.length, type).toBeGreaterThan(0);
      expect(payload).not.toEqual({ title: "Spotted", body: "You have a new update" });
    }
  });

  it("uses community context and privacy-safe DM fallback copy", () => {
    expect(
      formatPushPayload("community_invite", {
        actorName: "Mia",
        communityName: "Iron Club"
      })
    ).toEqual({
      title: "Mia invited you to Iron Club",
      body: "Join the crew."
    });
    expect(formatPushPayload("dm", { actorName: "Mia" })).toEqual({
      title: "Mia",
      body: "New message"
    });
  });
});
