import { describe, expect, it } from "vitest";

import {
  DEMO_TROPHY_STATS,
  earnedTrophyCount,
  evaluateGroups,
  evaluateTrophy,
  TROPHIES,
  type StandaloneTrophyDef,
  type StackedTrophyDef,
  type TrophyStats
} from "@/lib/trophies";

const bench = TROPHIES.find((t) => t.id === "bench") as StackedTrophyDef;
const streak = TROPHIES.find((t) => t.id === "streaks") as StackedTrophyDef;
const dayOne = TROPHIES.find((t) => t.id === "day-one") as StandaloneTrophyDef;
const nomad = TROPHIES.find((t) => t.id === "nomad") as StandaloneTrophyDef;
const rushHour = TROPHIES.find((t) => t.id === "rush-hour") as StandaloneTrophyDef;

describe("evaluateTrophy — demo state", () => {
  it("Day One is earned (single standalone)", () => {
    const r = evaluateTrophy(dayOne, DEMO_TROPHY_STATS);
    expect(r.earned).toBe(true);
    expect(r.earnedCount).toBe(1);
  });

  it("streak at 1 is in-progress: no tier earned, next is Week One with 1/7", () => {
    const r = evaluateTrophy(streak, DEMO_TROPHY_STATS);
    expect(r.earned).toBe(false);
    expect(r.earnedCount).toBe(0);
    expect(r.nextTier?.threshold).toBe(7);
    expect(r.progress).toEqual({ current: 1, target: 7, unit: "days" });
  });

  it("bench is fully locked (0/9)", () => {
    const r = evaluateTrophy(bench, DEMO_TROPHY_STATS);
    expect(r.earned).toBe(false);
    expect(r.earnedCount).toBe(0);
    expect(r.total).toBe(9);
    expect(r.highestTier).toBeUndefined();
  });

  it("Nomad shows 0/24 progress and is locked", () => {
    const r = evaluateTrophy(nomad, DEMO_TROPHY_STATS);
    expect(r.earned).toBe(false);
    expect(r.progress).toEqual({ current: 0, target: 24, unit: "hrs" });
  });

  it("a plain standalone (Rush Hour) is locked", () => {
    expect(evaluateTrophy(rushHour, DEMO_TROPHY_STATS).earned).toBe(false);
  });

  it("only Day One is earned across the whole set", () => {
    expect(earnedTrophyCount(DEMO_TROPHY_STATS)).toBe(1);
  });
});

describe("evaluateTrophy — stacked ladder math", () => {
  const stats: TrophyStats = {
    numbers: { benchMax: 230, streakBest: 21, streakCurrent: 3 },
    flags: {},
    dates: {}
  };

  it("counts earned bench tiers and points at the next", () => {
    const r = evaluateTrophy(bench, stats);
    // 135,185,205,225 earned (4); next is 275
    expect(r.earnedCount).toBe(4);
    expect(r.highestTier?.threshold).toBe(225);
    expect(r.nextTier?.threshold).toBe(275);
    expect(r.tiers?.find((t) => t.tier.threshold === 275)?.isNext).toBe(true);
  });

  it("streak uses best for earned, current for progress", () => {
    const r = evaluateTrophy(streak, stats);
    // best 21 → Week One, Two Weeks Deep, Habit Formed earned (3); next The Month(30)
    expect(r.earnedCount).toBe(3);
    expect(r.nextTier?.threshold).toBe(30);
    expect(r.progress?.current).toBe(3); // current streak, not best
    expect(r.progress?.target).toBe(30);
  });
});

describe("evaluateGroups", () => {
  it("returns all 8 categories in order", () => {
    const groups = evaluateGroups(DEMO_TROPHY_STATS);
    expect(groups.map((g) => g.category)).toEqual([
      "strength",
      "time-of-day",
      "dedication",
      "streaks",
      "weekend-warrior",
      "holidays",
      "home-turf",
      "firsts"
    ]);
    expect(groups.find((g) => g.category === "strength")?.trophies).toHaveLength(5);
    expect(groups.find((g) => g.category === "holidays")?.trophies).toHaveLength(9);
  });
});
