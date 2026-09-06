import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { logger } from "@/lib/logger";

/**
 * Camera drafts: captured media + in-progress edits, saved ONLY on explicit
 * intent ("Save as draft" on the details page, or the keep-as-draft prompt on
 * close). There is no autosave — that's what silently turned already-posted
 * photos into drafts.
 *
 * Design:
 *  - MULTIPLE drafts per user (newest first, capped at MAX_DRAFTS). They live
 *    until posted or deleted from the drafts page — no time-based expiry.
 *  - Media is COPIED into a dedicated document-directory folder so it survives
 *    cache eviction. Copies are deduped per source uri, and every write sweeps
 *    files no remaining draft references.
 *  - Loading verifies each draft's primary media still exists; broken drafts
 *    are dropped instead of restoring a dead screen.
 */

export type CameraDraft = {
  id: string;
  mode: "daily" | "lift";
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
  /** Lift video trim window (seconds). */
  videoTrim?: { start: number; end: number } | null;
  savedAt: number;
};

export type CameraDraftInput = Omit<CameraDraft, "id" | "savedAt">;

const LIST_KEY = (userId: string) => `camera-drafts:${userId}`;
/** Pre-multi-draft single slot — migrated into the list on first load. */
const LEGACY_KEY = (userId: string) => `camera-draft:${userId}`;
const DRAFT_DIR = `${FileSystem.documentDirectory}camera-drafts/`;
const MAX_DRAFTS = 20;

/** Source uri → persisted copy, so repeat saves never copy the same file twice. */
const persistedCopies = new Map<string, string>();

function newDraftId(): string {
  return `d-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

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

function mediaOf(draft: CameraDraft): string[] {
  return [draft.photoUri, draft.dualFrontUri, draft.videoUri, ...(draft.extraPhotos ?? [])].filter(
    (u): u is string => Boolean(u) && (u as string).startsWith(DRAFT_DIR)
  );
}

/** Delete every file in the drafts dir that NO remaining draft references. */
async function sweepUnreferenced(drafts: CameraDraft[]): Promise<void> {
  const keep = new Set(drafts.flatMap(mediaOf));
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

async function readList(userId: string): Promise<CameraDraft[]> {
  let list: CameraDraft[] = [];
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY(userId));
    if (raw) list = JSON.parse(raw) as CameraDraft[];
  } catch {
    list = [];
  }
  // One-time migration of the old single-slot draft.
  try {
    const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY(userId));
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Omit<CameraDraft, "id">;
      if (legacy.photoUri || legacy.videoUri) {
        list = [{ ...legacy, id: newDraftId() }, ...list];
      }
      await AsyncStorage.removeItem(LEGACY_KEY(userId));
      await writeList(userId, list);
    }
  } catch {
    // best-effort
  }
  return list;
}

async function writeList(userId: string, drafts: CameraDraft[]): Promise<void> {
  await AsyncStorage.setItem(LIST_KEY(userId), JSON.stringify(drafts));
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
 * Save a draft. Passing an existing `id` updates that draft in place (resumed
 * draft re-saved); otherwise a new draft is prepended. Returns the draft id.
 */
export async function saveCameraDraft(userId: string | null, draft: CameraDraftInput, id?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const [photoUri, dualFrontUri, videoUri, ...extras] = await Promise.all([
      persistMedia(draft.photoUri),
      persistMedia(draft.dualFrontUri),
      persistMedia(draft.videoUri),
      ...(draft.extraPhotos ?? []).map((u) => persistMedia(u))
    ]);
    const draftId = id ?? newDraftId();
    const full: CameraDraft = {
      ...draft,
      id: draftId,
      photoUri,
      dualFrontUri,
      videoUri,
      extraPhotos: extras.filter((u): u is string => Boolean(u)),
      savedAt: Date.now()
    };
    const list = await readList(userId);
    const next = [full, ...list.filter((d) => d.id !== draftId)].slice(0, MAX_DRAFTS);
    await writeList(userId, next);
    await sweepUnreferenced(next);
    return draftId;
  } catch (error) {
    logger.warn("camera_draft_save_failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** All saved drafts, newest first. Drafts whose media vanished are dropped. */
export async function loadCameraDrafts(userId: string | null): Promise<CameraDraft[]> {
  if (!userId) return [];
  try {
    const list = await readList(userId);
    const checks = await Promise.all(
      list.map(async (draft) => {
        const primary = draft.photoUri ?? draft.videoUri;
        if (!primary) return false;
        return fileExists(primary);
      })
    );
    const alive = list.filter((_, i) => checks[i]);
    for (const draft of alive) {
      if (draft.extraPhotos?.length) {
        const extraChecks = await Promise.all(draft.extraPhotos.map(fileExists));
        draft.extraPhotos = draft.extraPhotos.filter((_, i) => extraChecks[i]);
      }
      if (draft.dualFrontUri && !(await fileExists(draft.dualFrontUri))) {
        draft.dualFrontUri = null;
      }
    }
    if (alive.length !== list.length) {
      await writeList(userId, alive);
      await sweepUnreferenced(alive);
    }
    return alive;
  } catch {
    return [];
  }
}

/** Delete drafts by id (posted, or removed from the drafts page). */
export async function deleteCameraDrafts(userId: string | null, ids: string[]): Promise<void> {
  if (!userId || ids.length === 0) return;
  try {
    const remove = new Set(ids);
    const list = await readList(userId);
    const next = list.filter((d) => !remove.has(d.id));
    await writeList(userId, next);
    await sweepUnreferenced(next);
  } catch {
    // best-effort
  }
}

/* ---- resume hand-off (drafts page → camera, no router params needed) ---- */

let pendingResumeId: string | null = null;

/** Drafts page: mark this draft to open when the camera regains focus. */
export function requestDraftResume(id: string): void {
  pendingResumeId = id;
}

/** Camera: consume the pending resume request, if any. */
export function takeDraftResume(): string | null {
  const id = pendingResumeId;
  pendingResumeId = null;
  return id;
}
