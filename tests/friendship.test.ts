import { describe, expect, it } from "vitest";

import { areAcceptedFriends, hasExistingFriendship, sortedConversationParticipants } from "@/lib/friendship";

const edges = [
  { user_id: "a", friend_id: "b", status: "accepted" },
  { user_id: "c", friend_id: "a", status: "pending" },
  { user_id: "d", friend_id: "a", status: "blocked" }
] as const;

describe("friendship direction", () => {
  it("treats accepted friendships as bidirectional", () => {
    expect(areAcceptedFriends("a", "b", [...edges])).toBe(true);
    expect(areAcceptedFriends("b", "a", [...edges])).toBe(true);
  });

  it("detects pending or blocked existing edges", () => {
    expect(hasExistingFriendship("a", "c", [...edges])).toBe(true);
    expect(areAcceptedFriends("a", "c", [...edges])).toBe(false);
  });

  it("sorts conversation participants", () => {
    expect(sortedConversationParticipants("z", "a")).toEqual({ participant_a: "a", participant_b: "z" });
  });
});
