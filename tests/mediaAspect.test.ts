import { describe, expect, it } from "vitest";

import { clampPostRatio, DEFAULT_POST_RATIO, MAX_POST_RATIO, MIN_POST_RATIO } from "@/lib/postFrame";

describe("clampPostRatio (Instagram feed band: 3:4 … 1.91:1)", () => {
  it("shows an in-app 3:4 capture whole — the sensor-native frame", () => {
    expect(clampPostRatio(3024, 4032)).toBeCloseTo(3 / 4, 5);
    expect(MIN_POST_RATIO).toBeCloseTo(3 / 4, 5);
  });

  it("keeps the legacy 3:3.6 upload ratio unchanged (inside the band)", () => {
    expect(clampPostRatio(1440, 1728)).toBeCloseTo(3 / 3.6, 5);
  });

  it("keeps square and 4:5 photos at their own ratio", () => {
    expect(clampPostRatio(1080, 1080)).toBeCloseTo(1, 5);
    expect(clampPostRatio(1080, 1350)).toBeCloseTo(4 / 5, 5);
  });

  it("center-crops a full-screen phone capture down to 3:4 instead of a tower", () => {
    // iPhone 15 screen band capture: 1179x2556 (0.46) — the "way too long" case.
    expect(clampPostRatio(1179, 2556)).toBeCloseTo(MIN_POST_RATIO, 5);
  });

  it("clamps panoramas to the 1.91:1 landscape cap", () => {
    expect(clampPostRatio(4000, 1000)).toBeCloseTo(MAX_POST_RATIO, 5);
    expect(MAX_POST_RATIO).toBeCloseTo(1.91, 5);
  });

  it("falls back to the default frame on garbage sizes", () => {
    expect(clampPostRatio(0, 100)).toBe(DEFAULT_POST_RATIO);
    expect(clampPostRatio(100, 0)).toBe(DEFAULT_POST_RATIO);
    expect(DEFAULT_POST_RATIO).toBe(MIN_POST_RATIO);
  });
});
