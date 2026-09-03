/**
 * Pure post-frame math (no react-native import — unit-testable).
 *
 * Instagram's feed rule: the frame follows the photo's own aspect ratio, but
 * only inside a band from 3:4 (tallest) to 1.91:1 (widest). Inside the band
 * nothing is cropped; outside it the photo is center-cropped (cover) into the
 * nearest edge of the band. The band is what keeps a feed scannable — one
 * post can never be taller than 4/3 of the card width — and 3:4 is the phone
 * sensor's native ratio, so in-app captures always land inside it.
 */

import { POST_PHOTO_RATIO } from "@/lib/captureCrop";

/** The frame while a photo's real size is unknown: the camera's own 3:4. */
export const DEFAULT_POST_RATIO = POST_PHOTO_RATIO;

/** Tallest allowed frame (3:4 portrait). Taller photos get center-cropped. */
export const MIN_POST_RATIO = POST_PHOTO_RATIO;
/** Widest allowed frame (1.91:1 landscape). Wider photos get center-cropped. */
export const MAX_POST_RATIO = 1.91;

export function clampPostRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return DEFAULT_POST_RATIO;
  return Math.min(MAX_POST_RATIO, Math.max(MIN_POST_RATIO, width / height));
}
