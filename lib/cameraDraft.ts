import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { logger } from "@/lib/logger";

/**
 * Camera draft: the captured media + all in-progress edits persisted so a
 * crash, backgrounding, or a deliberate "Save draft" can be resumed later.
 *
 * Design:
 *  - ONE draft slot per user (this is a daily-post app — a new post replaces
 *    the old draft; drafts expire after 24h).
 *  - Media is COPIED into a dedicated document-directory folder so it survives
 *    cache eviction. Copies are deduped per source uri, and every save sweeps
 *    files the current draft no longer references, so retakes and repeated
 *    autosaves can't leak storage.
 *  - Loading verifies the media files still exist; a draft with missing media
 *    is dropped instead of restoring a broken screen.
 */

export type CameraDraft = {
  mode: "daily" | "story" | "lift";
  step: string;
  photoUri?: string | null;
  /** Front-camera frame for a dual post. */
  dualFrontUri?: string | null;
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
  /** Chosen gym / home / other — restored so location isn't re-asked. */
  gym?: { type: "gym"; id: string; name: string } | { type: "home" } | { type: "other" } | null;
  /** Positional photo tags (normalized 0–1 coords). */
  photoTags?: { userId: string; username: string; x: number; y: number }[];
  /** Friends tagged on a story. */
  storyTags?: string[];
  /** Lift video trim window (seconds). */
  videoTrim?: { start: number; end: number } | null;
  savedAt: number;
};

const KEY = (userId: string) => `camera-draft:${userId}`;
const DRAFT_DIR = `${FileSystem.documentDirectory}camera-drafts/`;
/** Drafts older than this are considered stale and ignored/cleared on load. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Source uri → persisted copy, so autosaves never copy the same file twice. */
const persistedCopies = new Map<string, string>();

async function persistMedia(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  // Already in our persistent dir — keep it.
  if (uri.startsWith(DRAFT_DIR)) return uri;
  const existing = persistedCopies.get(uri);
  if (existing) return existing;
  try {
    await FileSystem.makeDirectoryAsync(DRAFT_DIR, { intermediates: true }).catch(() => {});
    const ext = uri.split(".").pop()?.split("?")[0] || "jpg";
    const dest = `${DRAFT_DIR}${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    persistedCopies.set(uri, dest);
    return dest;
  } catch (error) {
    logger.warn("camera_draft_copy_failed", { message: error instanceof Error ? error.message : String(error) });
    // Fall back to the original uri — resume may still work if the cache survived.
    return uri;
  }
}

/** Delete every file in the drafts dir that the draft doesn't reference. */
async function sweepUnreferenced(keep: Set<string>): Promise<void> {
  try {
    const names = await FileSystem.readDirectoryAsync(DRAFT_DIR);
    await Promise.all(
      names
        .map((name) => `${DRAFT_DIR}${name}`)
        .filter((path) => !keep.has(path))
        .map((path) => FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}))
    );
  } catch {
    // dir may not exist yet
  }
}

/** Save (or update) the current draft. Media is copied to persistent storage. */
export async function saveCameraDraft(userId: string | null, draft: Omit<CameraDraft, "savedAt">): Promise<void> {
  if (!userId) return;
  try {
    const [photoUri, dualFrontUri, videoUri, ...extras] = await Promise.all([
      persistMedia(draft.photoUri),
      persistMedia(draft.dualFrontUri),
      persistMedia(draft.videoUri),
      ...(draft.extraPhotos ?? []).map((u) => persistMedia(u))
    ]);
    const full: CameraDraft = {
      ...draft,
      photoUri,
      dualFrontUri,
      videoUri,
      extraPhotos: extras.filter((u): u is string => Boolean(u)),
      savedAt: Date.now()
    };
    await AsyncStorage.setItem(KEY(userId), JSON.stringify(full));
    // Anything no longer referenced (old takes, superseded copies) goes away.
    const keep = new Set(
      [full.photoUri, full.dualFrontUri, full.videoUri, ...(full.extraPhotos ?? [])].filter(
        (u): u is string => Boolean(u) && (u as string).startsWith(DRAFT_DIR)
      )
    );
    await sweepUnreferenced(keep);
  } catch (error) {
    logger.warn("camera_draft_save_failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Load the saved draft, or null if none, stale, or its media is gone
 * (stale/broken drafts are cleared).
 */
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
    // A draft is only worth resuming if it has captured media…
    if (!draft.photoUri && !draft.videoUri) return null;
    // …that still exists on disk.
    const primary = draft.photoUri ?? draft.videoUri;
    if (primary && !(await fileExists(primary))) {
      await clearCameraDraft(userId);
      return null;
    }
    if (draft.extraPhotos?.length) {
      const checks = await Promise.all(draft.extraPhotos.map(fileExists));
      draft.extraPhotos = draft.extraPhotos.filter((_, i) => checks[i]);
    }
    if (draft.dualFrontUri && !(await fileExists(draft.dualFrontUri))) {
      draft.dualFrontUri = null;
    }
    return draft;
  } catch {
    return null;
  }
}

/** Clear the draft (on post or explicit delete) + remove ALL draft media. */
export async function clearCameraDraft(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(KEY(userId));
    persistedCopies.clear();
    // The dir is dedicated to drafts — removing it wholesale also collects any
    // orphans left behind by older versions of this module.
    await FileSystem.deleteAsync(DRAFT_DIR, { idempotent: true }).catch(() => {});
  } catch {
    // best-effort
  }
}
