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

  describe("rest days freeze the streak", () => {
    it("a rest day bridges the run without adding to it", () => {
      // Trained 3 days, rested yesterday, trained today: still 4 real gym days.
      expect(
        computeGymStreak(
          [keyOffset(0), keyOffset(2), keyOffset(3), keyOffset(4)],
          NOW,
          [keyOffset(1)]
        )
      ).toEqual({ count: 4, keepAlive: false });
    });

    it("does NOT increment the count", () => {
      // Same gym days, with and without a rest day in the middle, agree.
      const withRest = computeGymStreak([keyOffset(0), keyOffset(2)], NOW, [keyOffset(1)]);
      expect(withRest).toEqual({ count: 2, keepAlive: false });
    });

    it("today being a rest day keeps yesterday's streak alive", () => {
      expect(computeGymStreak([keyOffset(1), keyOffset(2)], NOW, [keyOffset(0)])).toEqual({
        count: 2,
        keepAlive: false
      });
    });

    it("rest days alone are not a streak", () => {
      expect(computeGymStreak([], NOW, [keyOffset(0), keyOffset(1)])).toEqual({
        count: 0,
        keepAlive: false
      });
    });

    it("a rest day does not bridge a two-day hole", () => {
      // Rested 1 day ago but did nothing 2 days ago — the older run is cut off.
      expect(
        computeGymStreak([keyOffset(3), keyOffset(4)], NOW, [keyOffset(1)])
      ).toEqual({ count: 0, keepAlive: false });
    });

    it("behaves exactly as before when no rest days are passed", () => {
      expect(computeGymStreak([keyOffset(0), keyOffset(1)], NOW)).toEqual({
        count: 2,
        keepAlive: false
      });
    });
  });
});
