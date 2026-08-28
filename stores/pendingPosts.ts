import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { PublishDailyPostInput } from "@/lib/posts";

/**
 * Offline post queue (Instagram/Snapchat-style): daily posts captured with no
 * connection are parked here — media already copied to the app's document
 * directory by lib/offlineQueue — and uploaded automatically when connectivity
 * returns. The queue is persisted so a relaunch (or a phone that died in the
 * gym locker room) never loses a post.
 */

export type PendingPostStatus =
  /** Waiting for connection — the uploader retries this automatically. */
  | "queued"
  /** Upload in flight right now. */
  | "uploading"
  /** A non-network error (server rejection) — needs a manual retry/discard. */
  | "failed";

export type PendingPost = {
  id: string;
  /** Epoch ms when the user hit Post — shown on the pending card. */
  createdAt: number;
  /** The exact publishDailyPost input; media URIs point into the pending dir. */
  input: PublishDailyPostInput;
  /** Tagged friend ids → post_tags rows (best-effort after publish). */
  tags: string[];
  /** Positional photo tags (normalized 0–1 coords). */
  photoTags: { userId: string; x: number; y: number }[];
  /** Workout logged just before the daily (workout-first flow) to attach. */
  workoutId: string | null;
  /** Communities to cross-post to (already gym-filtered at enqueue time). */
  communityIds: string[];
  attempts: number;
  status: PendingPostStatus;
};

type PendingPostsState = {
  entries: PendingPost[];
  hydrated: boolean;
  add: (entry: PendingPost) => void;
  remove: (id: string) => void;
  patch: (id: string, patch: Partial<Pick<PendingPost, "status" | "attempts">>) => void;
  replaceAll: (entries: PendingPost[], hydrated: boolean) => void;
};

const STORAGE_KEY = "pending-posts-v1";

function persistSoon(entries: PendingPost[]): void {
  // "uploading" must never be persisted — a relaunch mid-upload would show a
  // spinner that nothing is driving. Store those as queued so the uploader
  // picks them back up.
  const safe = entries.map((e) => (e.status === "uploading" ? { ...e, status: "queued" as const } : e));
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(safe)).catch(() => {});
}

export const usePendingPostsStore = create<PendingPostsState>((set) => ({
  entries: [],
  hydrated: false,
  add: (entry) =>
    set((state) => {
      const entries = [...state.entries, entry];
      persistSoon(entries);
      return { entries };
    }),
  remove: (id) =>
    set((state) => {
      const entries = state.entries.filter((e) => e.id !== id);
      persistSoon(entries);
      return { entries };
    }),
  patch: (id, patch) =>
    set((state) => {
      const entries = state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      persistSoon(entries);
      return { entries };
    }),
  replaceAll: (entries, hydrated) => set({ entries, hydrated })
}));

/** Wipe the queue from memory AND disk (account switch / sign-out). */
export async function clearAllPendingPosts(): Promise<void> {
  usePendingPostsStore.getState().replaceAll([], usePendingPostsStore.getState().hydrated);
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

/** Load the persisted queue (call once at app start, before flushing). */
export async function hydratePendingPosts(): Promise<void> {
  if (usePendingPostsStore.getState().hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingPost[]) : [];
    const entries = Array.isArray(parsed)
      ? parsed.filter((e) => e && typeof e.id === "string" && e.input && typeof e.input.userId === "string")
      : [];
    // Merge behind anything enqueued before hydration finished (cold-start race).
    const live = usePendingPostsStore.getState().entries;
    const liveIds = new Set(live.map((e) => e.id));
    usePendingPostsStore.getState().replaceAll([...entries.filter((e) => !liveIds.has(e.id)), ...live], true);
  } catch {
    usePendingPostsStore.getState().replaceAll(usePendingPostsStore.getState().entries, true);
  }
}
