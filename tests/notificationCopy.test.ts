import { describe, expect, it } from "vitest";

import type { AppNotification } from "../hooks/queries/useNotifications";
import {
  groupNotifications,
  mergeByActor,
  mergedNotificationText,
  notificationText,
  timeAgo
} from "../lib/notificationCopy";

function n(partial: Partial<AppNotification> & { id: string; type: string }): AppNotification {
  return {
    actorId: "a1",
    actorName: "Riley",
    actorUsername: "riley",
    actorAvatar: null,
    createdAt: new Date().toISOString(),
    read: false,
    payload: null,
    postThumbUrl: null,
    ...partial
  } as AppNotification;
}

describe("notification copy", () => {
  it("merges same actor + same type into one row with a count", () => {
    const rows = mergeByActor([
      n({ id: "1", type: "dm" }),
      n({ id: "2", type: "dm", read: true }),
      n({ id: "3", type: "taunt" })
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].count).toBe(2);
    expect(rows[0].mergedIds).toEqual(["1", "2"]);
    expect(rows[0].read).toBe(false);
    expect(mergedNotificationText(rows[0])).toBe("sent you 2 messages");
  });

  it("never merges non-mergeable types", () => {
    const rows = mergeByActor([n({ id: "1", type: "friend_accepted" }), n({ id: "2", type: "friend_accepted" })]);
    expect(rows).toHaveLength(2);
    expect(notificationText(rows[0])).toBe("accepted your friend request");
  });

  it("buckets by day and drops anything older than a week", () => {
    const now = new Date();
    const old = new Date(now.getTime() - 9 * 86_400_000).toISOString();
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString();
    const groups = groupNotifications(
      [
        n({ id: "t", type: "wave" }),
        n({ id: "y", type: "wave", createdAt: yesterday }),
        n({ id: "o", type: "wave", createdAt: old })
      ],
      now
    );
    expect(groups.map((g) => g.rows.length)).toEqual([1, 1, 0]);
  });

  it("formats relative time", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h");
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2d");
  });
});
