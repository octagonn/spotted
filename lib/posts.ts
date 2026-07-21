import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Feed images render near screen width; 1440px keeps them crisp on 3x displays
 * without bloating uploads, and 0.9 JPEG preserves detail (the previous 1080px
 * @ 0.7 was visibly soft).
 */
const MAX_UPLOAD_WIDTH = 1440;
const JPEG_QUALITY = 0.9;

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

/** Story photos are full-screen — same treatment as feed photos. */
export async function compressStoryPhoto(uri: string): Promise<string> {
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
  const ext = input.videoUri.toLowerCase().endsWith(".mp4") ? "mp4" : "mov";
  const path = `${input.userId}/lift-${Date.now()}.${ext}`;
  const upload = await supabase.storage.from("posts").upload(path, body, {
    contentType: ext === "mp4" ? "video/mp4" : "video/quicktime",
    upsert: false
  });
  if (upload.error) {
    throw upload.error;
  }
  const insert = await supabase
    .from("posts")
    .insert({
      user_id: input.userId,
      media_url: path,
      media_type: "video",
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
    await supabase.storage.from("posts").remove([path]).catch(() => {});
    throw insert.error;
  }
  return insert.data.id;
}

export type PublishDailyPostInput = {
  userId: string;
  /** Local file URIs from expo-camera — first is the cover; up to 4. */
  photoUris: string[];
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
    const path = `${input.userId}/${stamp}-${index}.jpg`;
    const upload = await supabase.storage.from("posts").upload(path, body, {
      contentType: "image/jpeg",
      upsert: false
    });
    if (upload.error) {
      await supabase.storage.from("posts").remove(paths).catch(() => {});
      throw upload.error;
    }
    paths.push(path);
  }

  const insert = await supabase
    .from("posts")
    .insert({
      user_id: input.userId,
      media_url: paths[0],
      media_urls: paths,
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
    // Don't leave orphaned objects behind if the row insert failed.
    await supabase.storage.from("posts").remove(paths).catch(() => {});
    throw insert.error;
  }
  return insert.data.id;
}
