import { describe, expect, it } from "vitest";

import { formatPushPayload } from "@/lib/pushPayload";

describe("push payload formatting", () => {
  it("formats post views", () => {
    expect(formatPushPayload("post_view", { actorName: "Mia" })).toEqual({
      title: "Eyes on you",
      body: "Mia viewed your pump drop"
    });
  });

  it("formats streak breaks without leaking timestamps", () => {
    expect(
      formatPushPayload("streak_break_friend", { actorName: "Octavio", muscleGroup: "leg", streakCount: 14 })
    ).toEqual({
      title: "Streak broken",
      body: "Octavio skipped leg day. Streak ended at 14."
    });
  });
});
