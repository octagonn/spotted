import { describe, expect, it } from "vitest";

import { isSafeNotificationRoute, routeForNotification } from "@/lib/notificationRouting";

const actorId = "8053699a-55b1-4ffd-a8cd-5a11ea09239a";
const postId = "e5a76dad-1fa2-484b-abfd-ccabce70adf8";
const communityId = "03e524a6-0315-4860-bdb2-0827667e2c48";

describe("notification routing", () => {
  it("routes messages, posts, communities, tags, and achievements", () => {
    expect(routeForNotification({ type: "dm", actorId })).toBe(`/chat/${actorId}`);
    expect(routeForNotification({ type: "post_reaction", payload: { post_id: postId } })).toBe(
      `/post/${postId}`
    );
    expect(
      routeForNotification({
        type: "community_invite",
        payload: { community_id: communityId }
      })
    ).toBe(`/community/${communityId}`);
    expect(routeForNotification({ type: "tagged", actorUsername: "mia_lifts" })).toBe(
      "/story?user=mia_lifts"
    );
    expect(routeForNotification({ type: "trophy_unlocked" })).toBe(
      "/profile-section/trophies"
    );
  });

  it("accepts only known internal push routes", () => {
    expect(isSafeNotificationRoute(`/post/${postId}`)).toBe(true);
    expect(isSafeNotificationRoute("https://example.com")).toBe(false);
    expect(isSafeNotificationRoute("//example.com")).toBe(false);
    expect(isSafeNotificationRoute("/settings/privacy")).toBe(false);
    expect(
      routeForNotification({
        type: "daily_nudge",
        url: "https://malicious.example"
      })
    ).toBe("/(tabs)/feed");
  });
});

