import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { logger } from "@/lib/logger";

/**
 * Camera draft (#24 reliability): the captured media + all in-progress edits
 * (caption, music, weight/exercise, tags, communities) persisted so a crash,
 * backgrounding, or interruption (incoming call) can be resumed. Media is
 * COPIED into the document directory so it survives cache eviction; the rest is
 * a small JSON blob in AsyncStorage.
 */

export type CameraDraft = {
  mode: "daily" | "story" | "lift";
  step: string;
  photoUri?: string | null;
  extraPhotos?: string[];
  videoUri?: string | null;
  caption?: string;
  track?: {
    id: string;
    title: string;
    artist: string;
    artworkUrl: string | null;
    previewUrl: string | null;
    clipStart?: number;
  } | null;
  liftExercise?: string;
  liftValue?: string;
  tags?: string[];
  communities?: string[];
  savedAt: number;
};

const KEY = (userId: string) => `camera-draft:${userId}`;
const DRAFT_DIR = `${FileSystem.documentDirectory}camera-drafts/`;
/** Drafts older than this are considered stale and ignored/cleared on load. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function persistMedia(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  // Already in our persistent dir — keep it.
  if (uri.startsWith(DRAFT_DIR)) return uri;
  try {
    await FileSystem.makeDirectoryAsync(DRAFT_DIR, { intermediates: true }).catch(() => {});
    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const dest = `${DRAFT_DIR}${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (error) {
    logger.warn("camera_draft_copy_failed", { message: error instanceof Error ? error.message : String(error) });
    // Fall back to the original uri — resume may still work if the cache survived.
    return uri;
  }
}

/** Save (or update) the current draft. Media is copied to persistent storage. */
export async function saveCameraDraft(userId: string | null, draft: Omit<CameraDraft, "savedAt">): Promise<void> {
  if (!userId) return;
  try {
    const [photoUri, videoUri, ...extras] = await Promise.all([
      persistMedia(draft.photoUri),
      persistMedia(draft.videoUri),
      ...(draft.extraPhotos ?? []).map((u) => persistMedia(u))
    ]);
    const full: CameraDraft = {
      ...draft,
      photoUri,
      videoUri,
      extraPhotos: extras.filter((u): u is string => Boolean(u)),
      savedAt: Date.now()
    };
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(full));
  } catch (error) {
    logger.warn("camera_draft_save_failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

/** Load the saved draft, or null if none / stale (stale is cleared). */
export async function loadCameraDraft(userId: string | null): Promise<CameraDraft | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as CameraDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) {
      await clearCameraDraft(userId);
      return null;
    }
    // A draft is only worth resuming if it has captured media.
    if (!draft.photoUri && !draft.videoUri) return null;
    return draft;
  } catch {
    return null;
  }
}

/** Clear the draft (on successful post or explicit discard) + delete its media. */
export async function clearCameraDraft(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    await AsyncStorage.removeItem(KEY(userId));
    if (raw) {
      const draft = JSON.parse(raw) as CameraDraft;
      const uris = [draft.photoUri, draft.videoUri, ...(draft.extraPhotos ?? [])].filter(
        (u): u is string => Boolean(u) && (u as string).startsWith(DRAFT_DIR)
      );
      await Promise.all(uris.map((u) => FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {})));
    }
  } catch {
    // best-effort
  }
}
