import { useEffect } from "react";
import { AppState } from "react-native";

import { flushPendingPosts } from "@/lib/offlineQueue";
import { hydratePendingPosts, usePendingPostsStore } from "@/stores/pendingPosts";

/** Retry cadence while posts wait for a connection. Attempts are cheap when
 * the radio is dead (fetch fails immediately), so a short interval is fine. */
const RETRY_MS = 20_000;

/**
 * Background uploader for the offline post queue. Mounted once in AppServices:
 * hydrates the persisted queue, then keeps trying to upload queued posts —
 * on an interval, whenever the app returns to the foreground, and immediately
 * after something new is enqueued.
 */
export function usePendingPostUploader(activeUserId: string | null): void {
  const queuedCount = usePendingPostsStore(
    (state) => state.entries.filter((e) => e.status === "queued").length
  );

  useEffect(() => {
    if (!activeUserId) return;
    void hydratePendingPosts().then(() => flushPendingPosts());
  }, [activeUserId]);

  useEffect(() => {
    if (!activeUserId || queuedCount === 0) return;
    void flushPendingPosts();
    const interval = setInterval(() => void flushPendingPosts(), RETRY_MS);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void flushPendingPosts();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [activeUserId, queuedCount]);
}
