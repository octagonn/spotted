import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";

import { logger } from "@/lib/logger";
import { removePostObjects, uploadPostObject } from "@/lib/r2";
import { supabase } from "@/lib/supabase";

/**
 * Feed photo upload size.
 *
 * 1080 was chosen as "the Instagram standard", but that standard predates 3x
 * displays: the feed photo frame is full-bleed, so on a 390pt-wide phone at @3x
 * it paints ~1170 device pixels — a 1080-wide upload was being UPSCALED on
 * every modern iPhone, which reads as softness no amount of JPEG quality fixes.
 * Posts are also pinch-zoomable, which wants headroom beyond 1:1.
 *
 * 1440 covers both with room to spare. R2 charges nothing for egress, so the
 * cost is storage alone (~700 KB/photo), and the 320px thumbnail still carries
 * the grids so scrolling is unaffected.
 */
const MAX_UPLOAD_WIDTH = 1440;
/** Grid/thumbnail width — grids only need a small image, not the full photo. */
const THUMB_WIDTH = 320;
/** 0.85 rings on the high-contrast edges of gym equipment and banding in flat
 *  gym lighting. 0.95: this is the LAST encode in the chain (capture and any
 *  edit re-encodes now run at ~1.0), so it sets the ceiling on what users see
 *  — worth the ~40% size bump over 0.9 on a zero-egress-cost bucket. */
const JPEG_QUALITY = 0.95;

/**
 * Downscale (only if larger than the target) + re-encode before upload. A raw
 * iPhone capture is several MB; this lands around 300-600 KB while staying
 * sharp. Falls back to the original URI if manipulation fails.
 */
async function compressPhoto(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);
    let image = await context.renderAsync();
    if (image.width > MAX_UPLOAD_WIDTH) {
      context.resize({ width: MAX_UPLOAD_WIDTH });
      image = await context.renderAsync();
    }
    const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return saved.uri;
  } catch (error) {
    logger.warn("post_photo_compress_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return uri;
  }
}

/** Chat photos are full-screen — same treatment as feed photos. */
export async function compressChatPhoto(uri: string): Promise<string> {
  return compressPhoto(uri);
}

/** Reaction selfies are tiny thumbnails — 400px is plenty and keeps them light. */
export async function compressReactionSelfie(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);
    let image = await context.renderAsync();
    if (image.width > 400) {
      context.resize({ width: 400 });
      image = await context.renderAsync();
    }
    const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
    return saved.uri;
  } catch (error) {
    logger.warn("reaction_selfie_compress_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return uri;
  }
}

/**
 * Generate a poster frame (~1s in) for a video and upload it to the posts
 * bucket next to the clip. Returns the storage path, or null if generation
 * fails — the feed/grid then falls back to a play-icon placeholder cell.
 */
async function generateAndUploadThumbnail(videoUri: string, userId: string, stamp: number): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000, quality: 0.7 });
    const compressed = await compressPhoto(uri);
    const response = await fetch(compressed);
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) return null;
    return await uploadPostObject(`${userId}/thumb-${stamp}.jpg`, body, "image/jpeg");
  } catch (error) {
    logger.warn("video_thumbnail_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Small (~320px) grid thumbnail for a photo post. Grids load this instead of
 * the full ~1080px image, cutting a 3-column grid from megabytes to kilobytes.
 * Best-effort — a failure just means the grid falls back to the full image.
 */
async function makePhotoThumbnail(photoUri: string, userId: string, stamp: number): Promise<string | null> {
  try {
    const context = ImageManipulator.manipulate(photoUri);
    context.resize({ width: THUMB_WIDTH });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
    const response = await fetch(saved.uri);
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) return null;
    return await uploadPostObject(`${userId}/pthumb-${stamp}.jpg`, body, "image/jpeg");
  } catch {
    return null;
  }
}

export type PublishLiftVideoInput = {
  userId: string;
  /** Local video file URI from expo-camera recordAsync. */
  videoUri: string;
  /** Soft-trim window in seconds (cut server-side later; honored at playback). */
  trimStart: number | null;
  trimEnd: number | null;
  liftName: string;
  liftWeight: string;
  /** Normalized lift for the trophy engine (null when no lift was logged). */
  liftExercise: string | null;
  liftValue: number | null;
  liftUnit: string | null;
  caption: string;
  gymId: string | null;
  locationKind: "gym" | "home" | "other";
};

/**
 * Upload the max-lift clip to the posts bucket and insert the video post row.
 * The trim range is stored as metadata — the feed player loops inside it.
 */
export async function publishLiftVideo(input: PublishLiftVideoInput): Promise<string> {
  const response = await fetch(input.videoUri);
  const body = await response.arrayBuffer();
  if (!body || body.byteLength === 0) {
    throw new Error("The recorded video could not be read.");
  }
  const stamp = Date.now();
  const ext = input.videoUri.toLowerCase().endsWith(".mp4") ? "mp4" : "mov";
  const path = await uploadPostObject(
    `${input.userId}/lift-${stamp}.${ext}`,
    body,
    ext === "mp4" ? "video/mp4" : "video/quicktime"
  );
  // Poster frame — best-effort; a failure just means a placeholder cell.
  const thumbnailPath = await generateAndUploadThumbnail(input.videoUri, input.userId, stamp);
  const insert = await supabase
    .from("posts")
    .insert({
      user_id: input.userId,
      media_url: path,
      media_type: "video",
      thumbnail_url: thumbnailPath,
      caption: input.caption.trim() ? input.caption.trim().slice(0, 200) : null,
      gym_id: input.gymId,
      location_kind: input.locationKind,
      lift_name: input.liftName,
      lift_weight: input.liftWeight,
      lift_exercise: input.liftExercise,
      lift_value: input.liftValue,
      lift_unit: input.liftUnit,
      video_trim_start: input.trimStart,
      video_trim_end: input.trimEnd,
      is_daily_drop: false
    })
    .select("id")
    .single();
  if (insert.error) {
    await removePostObjects([path, thumbnailPath].filter((p): p is string => Boolean(p))).catch(() => {});
    throw insert.error;
  }
  return insert.data.id;
}

export type PublishDailyPostInput = {
  userId: string;
  /** Local file URIs from expo-camera — first is the cover; up to 4. */
  photoUris: string[];
  /** A recorded daily video (hold-to-record) — takes precedence over photos. */
  videoUri?: string | null;
  /** Dual-camera front frame — rides as the BeReal-style corner inset. */
  insetUri?: string | null;
  caption: string;
  /** Real gyms.id UUID, or null for home/unlisted locations. */
  gymId: string | null;
  /** Where this was posted from: mapped gym, home gym, or unlisted. */
  locationKind: "gym" | "home" | "other";
  musicTitle: string | null;
  musicArtist: string | null;
  /** Apple 30s preview clip + artwork (iTunes Search API). */
  musicPreviewUrl: string | null;
  musicArtworkUrl: string | null;
  /** Seconds into the preview where the chosen clip starts. */
  musicClipStart: number;
};

/**
 * Upload the captured photo to the private `posts` bucket (under the user's
 * folder, per storage RLS) and insert the post row. The feed signs the storage
 * path at read time, so `media_url` stores the path, not a URL.
 */
export async function publishDailyPost(input: PublishDailyPostInput): Promise<string> {
  // Video daily post (hold-to-record) — upload the clip + poster frame and
  // insert a video daily-drop row (the feed renders it via RealVideoMedia).
  if (input.videoUri) {
    const response = await fetch(input.videoUri);
    const body = await response.arrayBuffer();
    if (!body || body.byteLength === 0) {
      throw new Error("The recorded video could not be read.");
    }
    const stamp = Date.now();
    const ext = input.videoUri.toLowerCase().endsWith(".mp4") ? "mp4" : "mov";
    const path = await uploadPostObject(
      `${input.userId}/daily-${stamp}.${ext}`,
      body,
      ext === "mp4" ? "video/mp4" : "video/quicktime"
    );
    const thumbnailPath = await generateAndUploadThumbnail(input.videoUri, input.userId, stamp);
    const insert = await supabase
      .from("posts")
      .insert({
        user_id: input.userId,
        media_url: path,
        media_type: "video",
        thumbnail_url: thumbnailPath,
        caption: input.caption.trim() ? input.caption.trim().slice(0, 200) : null,
        gym_id: input.gymId,
        location_kind: input.locationKind,
        music_title: input.musicTitle,
        music_artist: input.musicArtist,
        music_preview_url: input.musicPreviewUrl,
        music_artwork_url: input.musicArtworkUrl,
        music_clip_start: input.musicClipStart,
        is_daily_drop: true
      })
      .select("id")
      .single();
    if (insert.error) {
      await removePostObjects([path, thumbnailPath].filter((p): p is string => Boolean(p))).catch(() => {});
      throw insert.error;
    }
    return insert.data.id;
  }
  if (input.photoUris.length === 0) {
    throw new Error("No photos to upload.");
  }
  const stamp = Date.now();
  const paths: string[] = [];
  for (const [index, photoUri] of input.photoUris.entries()) {
    const uploadUri = await compressPhoto(photoUri);
    const response = await fetch(uploadUri);
    const body = await response.arrayBuffer();
    if (!body || body.byteLength === 0) {
      throw new Error("A captured photo could not be read.");
    }
    try {
      const path = await uploadPostObject(`${input.userId}/${stamp}-${index}.jpg`, body, "image/jpeg");
      paths.push(path);
    } catch (error) {
      await removePostObjects(paths).catch(() => {});
      throw error;
    }
  }

  // Dual-camera front frame → inset_url (BeReal corner PIP).
  let insetPath: string | null = null;
  if (input.insetUri) {
    const uploadUri = await compressPhoto(input.insetUri);
    const response = await fetch(uploadUri);
    const body = await response.arrayBuffer();
    if (body && body.byteLength > 0) {
      insetPath = await uploadPostObject(`${input.userId}/${stamp}-inset.jpg`, body, "image/jpeg").catch(() => null);
    }
  }

  // Small grid thumbnail from the cover photo (fast grids).
  const thumbPath = await makePhotoThumbnail(input.photoUris[0], input.userId, stamp);

  const insert = await supabase
    .from("posts")
    .insert({
      user_id: input.userId,
      media_url: paths[0],
      // A dual post is a single main frame + inset — not a swipeable carousel.
      media_urls: insetPath ? null : paths,
      inset_url: insetPath,
      thumbnail_url: thumbPath,
      media_type: "image",
      caption: input.caption.trim() ? input.caption.trim().slice(0, 200) : null,
      gym_id: input.gymId,
      location_kind: input.locationKind,
      music_title: input.musicTitle,
      music_artist: input.musicArtist,
      music_preview_url: input.musicPreviewUrl,
      music_artwork_url: input.musicArtworkUrl,
      music_clip_start: input.musicClipStart,
      is_daily_drop: true
    })
    .select("id")
    .single();
  if (insert.error) {
    // Don't leave orphaned objects behind if the row insert failed — include
    // the inset and grid thumbnail, not just the main photos.
    await removePostObjects([...paths, insetPath, thumbPath].filter((p): p is string => Boolean(p))).catch(() => {});
    throw insert.error;
  }
  return insert.data.id;
}

export type DailyPostExtras = {
  userId: string;
  /** Tagged friend ids → post_tags rows. */
  tags: string[];
  /** Positional photo tags (normalized 0–1 coords). */
  photoTags: { userId: string; x: number; y: number }[];
  /** Workout logged just before the daily (workout-first flow) to attach. */
  workoutId: string | null;
  /** Communities to cross-post to (pre-filtered for the chosen gym). */
  communityIds: string[];
};

/**
 * The best-effort rows that ride along with a daily post (friend tags,
 * positional photo tags, workout attach, community cross-posts). Shared by the
 * camera's online publish and the offline queue's deferred upload — each piece
 * logs-and-continues so a partial failure never sinks the post itself.
 */
export async function attachDailyPostExtras(postId: string, extras: DailyPostExtras): Promise<void> {
  if (extras.tags.length) {
    // Deduped + ignoreDuplicates: a repeated id must not fail the whole batch.
    const { error } = await supabase
      .from("post_tags")
      .upsert(
        [...new Set(extras.tags)].map((id) => ({ post_id: postId, user_id: id })),
        { onConflict: "post_id,user_id", ignoreDuplicates: true }
      );
    if (error) logger.warn("post_tags_insert_failed", { message: error.message });
  }
  if (extras.photoTags.length) {
    const { error } = await supabase
      .from("photo_tags")
      .insert(extras.photoTags.map((t) => ({ post_id: postId, photo_index: 0, user_id: t.userId, x: t.x, y: t.y })));
    if (error) logger.warn("photo_tags_insert_failed", { message: error.message });
  }
  if (extras.workoutId) {
    const { error } = await supabase
      .from("workouts")
      .update({ post_id: postId })
      .eq("id", extras.workoutId)
      .eq("user_id", extras.userId);
    if (error) logger.warn("workout_attach_failed", { message: error.message });
  }
  if (extras.communityIds.length) {
    const { error } = await supabase
      .from("post_communities")
      .insert(extras.communityIds.map((id) => ({ post_id: postId, community_id: id })));
    if (error) logger.warn("post_communities_insert_failed", { message: error.message });
  }
}
