import { describe, expect, it } from "vitest";

import { rankFeed, scorePost, UNVIEWED_BONUS } from "@/lib/feedRanking";
import type { FeedPost } from "@/types/domain";

const NOW = new Date("2026-07-03T12:00:00Z");

function post(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    caption: null,
    created_at: NOW.toISOString(),
    expires_at: new Date(NOW.getTime() + 24 * 3_600_000).toISOString(),
    gym_id: null,
    is_daily_drop: false,
    is_verified_at_gym: false,
    media_type: "photo",
    media_url: "posts/x.jpg",
    lift_name: null,
    lift_weight: null,
    location_kind: "other",
    media_urls: null,
    video_trim_start: null,
    video_trim_end: null,
    music_artist: null,
    music_artwork_url: null,
    music_clip_start: 0,
    music_preview_url: null,
    music_title: null,
    permanent: false,
    replay_count: 0,
    reply_count: 0,
    saved: false,
    updated_at: NOW.toISOString(),
    user_id: "author-1",
    profile: { id: "author-1", username: "a", display_name: "A", avatar_url: null, avatar_blurred_url: null },
    gym: null,
    viewer_count: 0,
    ...overrides
  };
}

const baseContext = { viewerId: "viewer-1", viewedPostIds: new Set<string>(), now: NOW };

describe("scorePost", () => {
  it("decays with age", () => {
    const fresh = post({ id: "p1" });
    const old = post({ id: "p2", created_at: new Date(NOW.getTime() - 12 * 3_600_000).toISOString() });
    expect(scorePost(fresh, baseContext)).toBeGreaterThan(scorePost(old, baseContext));
  });

  it("gives unviewed posts a bonus", () => {
    const p = post({ id: "p1" });
    const viewed = scorePost(p, { ...baseContext, viewedPostIds: new Set(["p1"]) });
    const unviewed = scorePost(p, baseContext);
    expect(unviewed - viewed).toBe(UNVIEWED_BONUS);
  });

  it("boosts verified-at-gym and daily drops, caps engagement", () => {
    const plain = post({ id: "p1" });
    const verified = post({ id: "p2", is_verified_at_gym: true });
    const daily = post({ id: "p3", is_daily_drop: true });
    const viral = post({ id: "p4", reply_count: 100, replay_count: 100 });
    expect(scorePost(verified, baseContext)).toBeGreaterThan(scorePost(plain, baseContext));
    expect(scorePost(daily, baseContext)).toBeGreaterThan(scorePost(plain, baseContext));
    expect(scorePost(viral, baseContext) - scorePost(plain, baseContext)).toBe(20);
  });

  it("penalizes the viewer's own posts", () => {
    const own = post({ id: "p1", user_id: "viewer-1" });
    const friend = post({ id: "p2" });
    expect(scorePost(friend, baseContext)).toBeGreaterThan(scorePost(own, baseContext));
  });
});

describe("rankFeed", () => {
  it("floats an unviewed slightly-older post above a viewed fresh one", () => {
    const viewedFresh = post({ id: "seen" });
    const unviewedOlder = post({ id: "unseen", created_at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString() });
    const ranked = rankFeed([viewedFresh, unviewedOlder], { ...baseContext, viewedPostIds: new Set(["seen"]) });
    expect(ranked.map((p) => p.id)).toEqual(["unseen", "seen"]);
  });

  it("keeps pure reverse-chron when signals are equal", () => {
    const older = post({ id: "older", created_at: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() });
    const newer = post({ id: "newer", created_at: new Date(NOW.getTime() - 1 * 3_600_000).toISOString() });
    const ranked = rankFeed([older, newer], baseContext);
    expect(ranked.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input array", () => {
    const posts = [post({ id: "a" }), post({ id: "b" })];
    const copy = [...posts];
    rankFeed(posts, baseContext);
    expect(posts).toEqual(copy);
  });
});
