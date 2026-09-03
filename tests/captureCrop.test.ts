import { describe, expect, it } from "vitest";

import { INSET_RATIO, POST_PHOTO_RATIO, captureCropRect } from "@/lib/captureCrop";

/** iPhone 15 logical screen, portrait. */
const SCREEN = 393 / 852;
/** Photo session (4:3) and 1080p video session (16:9), portrait w/h. */
const PHOTO_12MP = { w: 3024, h: 4032 };
const VIDEO_1080 = { w: 1080, h: 1920 };

const ratioOf = (r: { width: number; height: number }) => r.width / r.height;

describe("captureCropRect", () => {
  it("keeps the whole frame when nothing is constrained", () => {
    expect(captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, null, null)).toBeNull();
  });

  it("crops a photo-session capture to the post ratio", () => {
    const rect = captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, SCREEN, POST_PHOTO_RATIO);
    expect(rect).not.toBeNull();
    expect(ratioOf(rect!)).toBeCloseTo(POST_PHOTO_RATIO, 2);
  });

  it("drops the sides the aspect-filled preview hid", () => {
    // Without previewRatio the crop keeps the FULL sensor width — 4:3 overflows
    // a full-screen preview badly, so the post would include a lot the user
    // never saw. (A 4:5 target: the 3:4 post ratio is sensor-native, so it
    // would be a no-op and prove nothing here.)
    const TARGET = 4 / 5;
    const blind = captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, null, TARGET)!;
    const honest = captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, SCREEN, TARGET)!;
    expect(honest.width).toBeLessThan(blind.width);
    // The visible width is the screen's share of the sensor height.
    expect(honest.width).toBeCloseTo(Math.round(PHOTO_12MP.h * SCREEN), 0);
  });

  it("stays centred on both axes", () => {
    const rect = captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, SCREEN, POST_PHOTO_RATIO)!;
    expect(rect.originX * 2 + rect.width).toBeCloseTo(PHOTO_12MP.w, 0);
    expect(rect.originY * 2 + rect.height).toBeCloseTo(PHOTO_12MP.h, 0);
  });

  it("never asks for pixels the capture does not have", () => {
    for (const src of [PHOTO_12MP, VIDEO_1080]) {
      for (const ratio of [POST_PHOTO_RATIO, INSET_RATIO]) {
        const rect = captureCropRect(src.w, src.h, SCREEN, ratio)!;
        expect(rect.originX).toBeGreaterThanOrEqual(0);
        expect(rect.originY).toBeGreaterThanOrEqual(0);
        expect(rect.originX + rect.width).toBeLessThanOrEqual(src.w);
        expect(rect.originY + rect.height).toBeLessThanOrEqual(src.h);
      }
    }
  });

  it("produces the same framing from either session preset", () => {
    // The whole point of the picture-mode switch: more pixels, same picture.
    const photo = captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, SCREEN, POST_PHOTO_RATIO)!;
    const video = captureCropRect(VIDEO_1080.w, VIDEO_1080.h, SCREEN, POST_PHOTO_RATIO)!;
    expect(ratioOf(photo)).toBeCloseTo(ratioOf(video), 2);
    // …and the photo session genuinely carries more resolution.
    expect(photo.width).toBeGreaterThan(video.width * 1.5);
  });

  it("crops the dual selfie to the inset frame", () => {
    const rect = captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, SCREEN, INSET_RATIO)!;
    expect(ratioOf(rect)).toBeCloseTo(INSET_RATIO, 2);
  });

  it("is a no-op for a 3:4 sensor frame shot through the 3:4 viewfinder", () => {
    // The daily camera: viewfinder ratio == post ratio == sensor ratio, so the
    // whole capture posts untouched (no re-encode, no lost pixels).
    expect(captureCropRect(PHOTO_12MP.w, PHOTO_12MP.h, POST_PHOTO_RATIO, POST_PHOTO_RATIO)).toBeNull();
  });

  it("trims a 16:9 sensor frame to exactly what the 3:4 viewfinder showed", () => {
    const rect = captureCropRect(VIDEO_1080.w, VIDEO_1080.h, POST_PHOTO_RATIO, POST_PHOTO_RATIO)!;
    expect(ratioOf(rect)).toBeCloseTo(POST_PHOTO_RATIO, 2);
    expect(rect.width).toBe(VIDEO_1080.w);
  });

  it("handles a landscape-ish preview without inverting the crop", () => {
    const rect = captureCropRect(4032, 3024, 16 / 9, POST_PHOTO_RATIO)!;
    expect(ratioOf(rect)).toBeCloseTo(POST_PHOTO_RATIO, 2);
    expect(rect.width).toBeLessThanOrEqual(4032);
    expect(rect.height).toBeLessThanOrEqual(3024);
  });
});
