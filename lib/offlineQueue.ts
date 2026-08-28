import * as FileSystem from "expo-file-system/legacy";

import { logger } from "@/lib/logger";
import { attachDailyPostExtras, publishDailyPost, type PublishDailyPostInput } from "@/lib/posts";
import { invalidateAfterPostChange, queryClient } from "@/lib/queryClient";
import { clearAllPendingPosts, usePendingPostsStore, type PendingPost } from "@/stores/pendingPosts";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";

/**
 * Offline post queue engine. Gyms routinely have dead cell service, so a
 * publish that fails on the NETWORK (as opposed to a server rejection) is
 * parked instead of lost: media is copied into the app's document directory
 * (camera cache files get evicted), the entry is persisted, and
 * flushPendingPosts uploads everything the moment a request gets through.
 */

const PENDING_DIR = `${FileSystem.documentDirectory}pending-posts/`;

/**
 * Was this a connectivity failure (queue it) vs a server rejection (surface
 * it)? RN's fetch throws TypeError("Network request failed"); supabase-js and
 * the storage client wrap the same message. Err on the side of queueing —
 * a queued post retries harmlessly, a discarded one is gone.
 */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|network error|fetch failed|failed to fetch|timeout|timed out|socket|econn|enotfound|internet|aborted/i.test(
    message
  );
}

async function copyIntoPendingDir(uri: string | null | undefined, entryId: string, name: string): Promise<string | null> {
  if (!uri) return null;
  const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
  const dest = `${PENDING_DIR}${entryId}-${name}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export type EnqueueDailyPostArgs = {
  input: PublishDailyPostInput;
  tags: string[];
  photoTags: { userId: string; x: number; y: number }[];
  workoutId: string | null;
  communityIds: string[];
};

/**
 * Park a daily post for later upload. Copies every media file to persistent
 * storage FIRST (the caller may clear the camera draft right after), then
 * records the entry. Throws if the media can't be copied — the caller falls
 * back to the normal "couldn't post" alert in that case.
 */
export async function enqueueDailyPost(args: EnqueueDailyPostArgs): Promise<void> {
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true }).catch(() => {});
  const photoUris = (
    await Promise.all(args.input.photoUris.map((uri, index) => copyIntoPendingDir(uri, id, `photo-${index}`)))
  ).filter((u): u is string => Boolean(u));
  const videoUri = await copyIntoPendingDir(args.input.videoUri, id, "video");
  const insetUri = await copyIntoPendingDir(args.input.insetUri, id, "inset");
  if (photoUris.length === 0 && !videoUri) {
    throw new Error("No media could be copied for the pending post.");
  }
  const entry: PendingPost = {
    id,
    createdAt: Date.now(),
    input: { ...args.input, photoUris, videoUri, insetUri },
    tags: args.tags,
    photoTags: args.photoTags,
    workoutId: args.workoutId,
    communityIds: args.communityIds,
    attempts: 0,
    status: "queued"
  };
  usePendingPostsStore.getState().add(entry);
  logger.info("pending_post_enqueued", { id, media: videoUri ? "video" : `photos:${photoUris.length}` });
}

async function deleteEntryFiles(entry: PendingPost): Promise<void> {
  const files = [...entry.input.photoUris, entry.input.videoUri, entry.input.insetUri].filter(
    (u): u is string => Boolean(u) && (u as string).startsWith(PENDING_DIR)
  );
  await Promise.all(files.map((path) => FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {})));
}

/** Serialize flushes — overlapping timers/foreground events must not double-upload. */
let flushing = false;

/**
 * Try to upload every queued post for the signed-in user, oldest first.
 * Network failures put the entry back to "queued" (the caller retries later);
 * anything else marks it "failed" so the pending strip offers retry/discard.
 */
export async function flushPendingPosts(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const userId = useAuthStore.getState().userId;
    if (!userId) return;
    const store = usePendingPostsStore.getState();
    const queued = store.entries.filter((e) => e.status === "queued" && e.input.userId === userId);
    for (const entry of queued) {
      usePendingPostsStore.getState().patch(entry.id, { status: "uploading" });
      try {
        const postId = await publishDailyPost(entry.input);
        await attachDailyPostExtras(postId, {
          userId: entry.input.userId,
          tags: entry.tags,
          photoTags: entry.photoTags,
          workoutId: entry.workoutId,
          communityIds: entry.communityIds
        }).catch(() => {});
        await deleteEntryFiles(entry);
        usePendingPostsStore.getState().remove(entry.id);
        void invalidateAfterPostChange(queryClient);
        if (entry.tags.length) void queryClient.invalidateQueries({ queryKey: ["tagged-posts"] });
        showToast("Back online — your post is live");
        logger.info("pending_post_uploaded", { id: entry.id, attempts: entry.attempts + 1 });
      } catch (error) {
        const network = isNetworkError(error);
        usePendingPostsStore.getState().patch(entry.id, {
          status: network ? "queued" : "failed",
          attempts: entry.attempts + 1
        });
        logger.warn("pending_post_upload_failed", {
          id: entry.id,
          network,
          message: error instanceof Error ? error.message : String(error)
        });
        // Still offline — later entries will fail the same way; stop the pass.
        if (network) break;
      }
    }
  } finally {
    flushing = false;
  }
}

/** Manual retry from the pending strip: failed → queued, then flush now. */
export function retryPendingPost(id: string): void {
  usePendingPostsStore.getState().patch(id, { status: "queued" });
  void flushPendingPosts();
}

/** Discard a pending post entirely (files + entry). */
export async function discardPendingPost(id: string): Promise<void> {
  const entry = usePendingPostsStore.getState().entries.find((e) => e.id === id);
  if (entry) await deleteEntryFiles(entry);
  usePendingPostsStore.getState().remove(id);
}

/** Account switch / sign-out: drop every queued post and its media. */
export async function clearPendingPosts(): Promise<void> {
  await clearAllPendingPosts();
  await FileSystem.deleteAsync(PENDING_DIR, { idempotent: true }).catch(() => {});
}
