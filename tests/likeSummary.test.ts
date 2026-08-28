import { describe, expect, it } from "vitest";

import type { PostLiker } from "@/hooks/queries/usePostReactions";
import { summarizeLikers } from "@/lib/likeSummary";

const liker = (userId: string, displayName: string, username = displayName.toLowerCase()): PostLiker => ({
  userId,
  username,
  displayName,
  avatarUrl: null,
  createdAt: "2026-08-20T00:00:00.000Z"
});

const MASON = liker("u-mason", "Mason");
const RYAN = liker("u-ryan", "Ryan");
const JADE = liker("u-jade", "Jade");
const ME = liker("u-me", "Octavio");

describe("summarizeLikers", () => {
  it("renders nothing when nobody liked the post", () => {
    expect(summarizeLikers([], "u-me")).toBeNull();
  });

  it("names a single liker", () => {
    expect(summarizeLikers([MASON], "u-me")).toEqual({
      lead: "Mason",
      others: 0,
      label: "Liked by Mason"
    });
  });

  it("names both people when exactly two liked it", () => {
    expect(summarizeLikers([MASON, RYAN], "u-me")).toEqual({
      lead: "Mason",
      second: "Ryan",
      others: 0,
      label: "Liked by Mason and Ryan"
    });
  });

  it("counts the rest once there are too many to name", () => {
    expect(summarizeLikers([MASON, RYAN, JADE], "u-me")).toEqual({
      lead: "Mason",
      others: 2,
      label: "Liked by Mason and 2 others"
    });
  });

  it("leads with you when you liked it, wherever you sit in the list", () => {
    expect(summarizeLikers([MASON, RYAN, ME], "u-me")).toEqual({
      lead: "you",
      others: 2,
      label: "Liked by you and 2 others"
    });
    expect(summarizeLikers([ME], "u-me")).toEqual({
      lead: "you",
      others: 0,
      label: "Liked by you"
    });
  });

  it("prefers a friend over a stranger who liked more recently", () => {
    // Newest-first order puts the stranger on top; the friend should still lead.
    const summary = summarizeLikers([JADE, RYAN, MASON], "u-me", new Set(["u-mason"]));
    expect(summary?.lead).toBe("Mason");
    expect(summary?.others).toBe(2);
  });

  it("falls back to the most recent liker when no friend liked it", () => {
    expect(summarizeLikers([JADE, RYAN], "u-me", new Set(["u-nobody"]))?.lead).toBe("Jade");
  });

  it("never leaves the name blank", () => {
    const anon: PostLiker = { ...liker("u-x", ""), username: "", displayName: "" };
    expect(summarizeLikers([anon], "u-me")?.lead).toBe("Someone");
  });

  it("does not count the lead twice when they liked it once", () => {
    const summary = summarizeLikers([MASON, RYAN, JADE, ME], "u-me");
    // 4 likers, you lead → 3 others.
    expect(summary?.others).toBe(3);
  });
});
