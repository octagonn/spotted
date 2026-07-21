import { describe, expect, it } from "vitest";

import { computeGymStreak } from "@/lib/streak";

const NOW = new Date(2026, 6, 15, 14, 30); // Jul 15 2026, mid-afternoon (local)

function keyOffset(days: number): string {
  const d = new Date(2026, 6, 15);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("computeGymStreak", () => {
  it("posting today continues the streak", () => {
    expect(computeGymStreak([keyOffset(0), keyOffset(1), keyOffset(2)], NOW)).toEqual({
      count: 3,
      keepAlive: false
    });
  });

  it("posting only today is a streak of 1", () => {
    expect(computeGymStreak([keyOffset(0)], NOW)).toEqual({ count: 1, keepAlive: false });
  });

  it("posted yesterday but not today stays alive at 1 (grace window)", () => {
    expect(computeGymStreak([keyOffset(1)], NOW)).toEqual({ count: 1, keepAlive: true });
  });

  it("yesterday grace still counts the earlier run", () => {
    expect(computeGymStreak([keyOffset(1), keyOffset(2), keyOffset(3)], NOW)).toEqual({
      count: 3,
      keepAlive: true
    });
  });

  it("a two-day gap has lapsed to 0", () => {
    expect(computeGymStreak([keyOffset(2), keyOffset(3)], NOW)).toEqual({ count: 0, keepAlive: false });
  });

  it("no posts is 0", () => {
    expect(computeGymStreak([], NOW)).toEqual({ count: 0, keepAlive: false });
  });

  it("ignores a non-consecutive older cluster", () => {
    // today + yesterday, then a gap, then older days — only the current run counts.
    expect(computeGymStreak([keyOffset(0), keyOffset(1), keyOffset(4), keyOffset(5)], NOW)).toEqual({
      count: 2,
      keepAlive: false
    });
  });
});
