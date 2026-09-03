/**
 * Post photo frame ratio (w/h) — the feed's main photo frame AND the daily
 * camera's viewfinder.
 *
 * 3:4 is the phone camera sensor's native portrait ratio (the reason
 * Instagram moved its feed to 3:4 in 2025): the viewfinder shows the whole
 * sensor frame, the capture is exactly what was on screen, and the feed shows
 * the whole capture. Nothing is cropped at any step.
 */
export const POST_PHOTO_RATIO = 3 / 4;
/** Dual-selfie inset frame ratio (matches the feed inset). */
export const INSET_RATIO = 3 / 4;

/**
 * The rectangle of a capture that should survive, as ONE crop.
 *
 * `previewRatio` (the on-screen preview's w/h) matters because the camera
 * preview aspect-FILLS: whatever is wider than the screen is hidden off the
 * sides. Cropping only vertically therefore posts content the user never saw —
 * an 18% horizontal overshoot on the 16:9 video session, and 38% on the 4:3
 * photo session. Trimming to the visible region first makes the crop mask an
 * honest promise on both axes.
 */
export function captureCropRect(
  width: number,
  height: number,
  previewRatio: number | null,
  ratio: number | null
): { originX: number; originY: number; width: number; height: number } | null {
  let w = width;
  let h = height;
  if (previewRatio) {
    // Aspect-fill: the tighter axis is the one that overflows and gets hidden.
    if (previewRatio < w / h) w = Math.round(h * previewRatio);
    else h = Math.round(w / previewRatio);
  }
  if (ratio) {
    if (w / h > ratio) w = Math.round(h * ratio);
    else h = Math.round(w / ratio);
  }
  if (w >= width && h >= height) return null;
  return {
    originX: Math.round((width - w) / 2),
    originY: Math.round((height - h) / 2),
    width: w,
    height: h
  };
}
