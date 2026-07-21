import { describe, expect, it } from "vitest";

import { CATEGORY_ORDER, TROPHIES, TROPHIES_BY_ID } from "@/lib/trophies";
import { deriveAchievements, deriveProgress, easterDate, isHolidayDate, thanksgivingDate, type TrophyStats } from "@/lib/trophyEngine";
import { verifyLift } from "@/lib/verifyLift";
import { categorySections, earnedEntries, earnedTrophyCount, tierLadder } from "@/lib/trophySelectors";

const NOW = "2026-07-20T12:00:00.000Z";

function stats(partial: Partial<TrophyStats>): TrophyStats {
  return { numbers: {}, flags: {}, dates: {}, ...partial };
}

describe("catalog", () => {
  it("has all 8 categories in the fixed order", () => {
    expect(CATEGORY_ORDER).toEqual([
      "strength", "time-of-day", "dedication", "streaks",
      "weekend-warrior", "holidays", "home-turf", "firsts"
    ]);
  });

  it("uses the exact spec names for key tiers", () => {
    const bench = TROPHIES_BY_ID.bench;
    expect(bench.tiers?.find((t) => t.value === 135)?.name).toBe("Warming Up");
    expect(bench.tiers?.find((t) => t.value === 405)?.name).toBe("The 405 Club");
    expect(bench.tiers?.find((t) => t.value === 500)?.name).toBe("Titan");
    expect(TROPHIES_BY_ID.streaks.tiers?.find((t) => t.value === 21)?.name).toBe("Shaken, Not Stirred");
    expect(TROPHIES_BY_ID.streaks.tiers?.find((t) => t.value === 365)?.name).toBe("Year of Iron");
    expect(TROPHIES_BY_ID["home-turf"].tiers?.find((t) => t.value === 500)?.name).toBe("They Named a Bench After You");
  });

  it("marks strength as video-verified and streaks/home turf as progress", () => {
    expect(TROPHIES_BY_ID.bench.trackingType).toBe("videoVerification");
    expect(TROPHIES_BY_ID.streaks.trackingType).toBe("progress");
    expect(TROPHIES_BY_ID["home-turf"].trackingType).toBe("progress");
    expect(TROPHIES_BY_ID.nomad.trackingType).toBe("progress");
    expect(TROPHIES_BY_ID["rush-hour"].trackingType).toBe("automatic");
    expect(TROPHIES_BY_ID.heartbreaker.trackingType).toBe("dateBased");
  });
});

describe("deriveAchievements — demo state (Day One + streak 1)", () => {
  const demo = stats({ flags: { firstPost: true }, dates: { "day-one": "2026-07-14T09:00:00.000Z" }, numbers: { streakCurrent: 1, streakBest: 1 } });

  it("earns only Day One, with its exact date", () => {
    const ach = deriveAchievements(demo, NOW);
    expect(ach).toHaveLength(1);
    expect(ach[0].trophyId).toBe("day-one");
    expect(ach[0].tierId).toBeNull();
    expect(ach[0].earnedAt).toBe("2026-07-14T09:00:00.000Z");
  });

  it("earned tab shows only Day One", () => {
    const entries = earnedEntries(deriveAchievements(demo, NOW));
    expect(entries).toHaveLength(1);
    expect(entries[0].displayName).toBe("Day One");
  });
});

describe("deriveAchievements — stacked tiers keep separate dates", () => {
  const s = stats({
    numbers: { streakBest: 21, streakCurrent: 3 },
    dates: { "streaks:7": "2026-01-08T00:00:00.000Z", "streaks:14": "2026-01-15T00:00:00.000Z", "streaks:21": "2026-01-22T00:00:00.000Z" }
  });

  it("creates one achievement per earned tier with its own earnedAt", () => {
    const ach = deriveAchievements(s, NOW).filter((a) => a.trophyId === "streaks");
    expect(ach).toHaveLength(3);
    expect(ach.map((a) => a.tierId).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([7, 14, 21]);
    const byTier = Object.fromEntries(ach.map((a) => [a.tierId, a.earnedAt]));
    expect(byTier[7]).toBe("2026-01-08T00:00:00.000Z");
    expect(byTier[21]).toBe("2026-01-22T00:00:00.000Z");
  });

  it("earned tab lists every earned tier separately, newest first", () => {
    const entries = earnedEntries(deriveAchievements(s, NOW)).filter((e) => e.def.id === "streaks");
    expect(entries).toHaveLength(3);
    expect(entries[0].displayName).toBe("Shaken, Not Stirred"); // 21, newest date
  });
});

describe("tier cascade", () => {
  it("earning a high tier auto-earns every lower tier in the line", () => {
    // Bench best 320 → 135,185,205,225,275,315 all earned (6), 365+ not.
    const ach = deriveAchievements(stats({ numbers: { benchMax: 320 } }), NOW).filter((a) => a.trophyId === "bench");
    expect(ach.map((a) => a.tierId).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([135, 185, 205, 225, 275, 315]);
  });

  it("a single high value cascades even if only that value is set", () => {
    const rows = tierLadder(TROPHIES_BY_ID.streaks, deriveAchievements(stats({ numbers: { streakBest: 100 } }), NOW));
    // 7,14,21,30,60,100 earned; 365 not.
    expect(rows.filter((r) => r.earned).map((r) => r.tier.value)).toEqual([7, 14, 21, 30, 60, 100]);
    expect(rows.find((r) => r.tier.value === 365)?.earned).toBe(false);
  });
});

describe("idempotency", () => {
  it("reprocessing the same stats yields identical achievement ids (no dupes)", () => {
    const s = stats({ numbers: { streakBest: 14 } });
    const a1 = deriveAchievements(s, NOW).map((a) => a.achievementId);
    const a2 = deriveAchievements(s, NOW).map((a) => a.achievementId);
    expect(a1).toEqual(a2);
    expect(new Set(a1).size).toBe(a1.length);
  });
});

describe("progress", () => {
  it("streak progress uses current toward the next unearned target", () => {
    const s = stats({ numbers: { streakBest: 14, streakCurrent: 3 } });
    const prog = deriveProgress(s).find((p) => p.trophyId === "streaks");
    expect(prog?.currentValue).toBe(3);
    expect(prog?.targetValue).toBe(21); // next after best(14)
  });
});

describe("categorySections", () => {
  it("shows one card per family and preserves category order", () => {
    const sections = categorySections([], []);
    expect(sections.map((s) => s.category)).toEqual(CATEGORY_ORDER);
    expect(sections.find((s) => s.category === "strength")?.cards).toHaveLength(5);
    expect(sections.find((s) => s.category === "holidays")?.cards).toHaveLength(9);
    // A stacked family is a single card.
    expect(sections.find((s) => s.category === "streaks")?.cards).toHaveLength(1);
  });

  it("locked stacked card shows the first tier and 0/N", () => {
    const [strength] = categorySections([], []);
    const bench = strength.cards.find((c) => c.def.id === "bench")!;
    expect(bench.earned).toBe(false);
    expect(bench.tierPosition).toBe("0/9");
    expect(bench.displayName).toBe("Warming Up");
  });
});

describe("tierLadder", () => {
  it("marks earned rows and the single next row, no date on locked", () => {
    const ach = deriveAchievements(stats({ numbers: { streakBest: 14 }, dates: { "streaks:7": "2026-01-08T00:00:00.000Z" } }), NOW);
    const rows = tierLadder(TROPHIES_BY_ID.streaks, ach);
    expect(rows[0].earned).toBe(true); // 7
    expect(rows[1].earned).toBe(true); // 14
    expect(rows[2].earned).toBe(false); // 21
    expect(rows[2].isNext).toBe(true);
    expect(rows[3].isNext).toBe(false);
    expect(rows[2].earnedAt).toBeNull();
  });
});

describe("earnedTrophyCount", () => {
  it("counts families with at least one earned tier/standalone", () => {
    const ach = deriveAchievements(stats({ flags: { firstPost: true }, numbers: { streakBest: 14 } }), NOW);
    expect(earnedTrophyCount(ach)).toBe(2); // day-one + streaks
  });
});

describe("holiday dates (dynamic)", () => {
  it("computes Easter and Thanksgiving for the year", () => {
    expect(easterDate(2026).getMonth()).toBe(3); // April
    expect(easterDate(2026).getDate()).toBe(5);
    const tg = thanksgivingDate(2026);
    expect(tg.getMonth()).toBe(10); // November
    expect(tg.getDate()).toBe(26);
  });

  it("matches holiday check-in dates", () => {
    expect(isHolidayDate("american-made", new Date(2026, 6, 4))).toBe(true);
    expect(isHolidayDate("american-made", new Date(2026, 6, 5))).toBe(false);
    expect(isHolidayDate("turkey-bowl", new Date(2026, 10, 26))).toBe(true);
  });
});

describe("verifyLift stub", () => {
  it("stays pending and reports the stat it would bump", () => {
    const r = verifyLift({ exercise: "bench", value: 225, unit: "lb", mediaId: "m1", performedAt: NOW });
    expect(r.accepted).toBe(false);
    expect(r.status).toBe("pending-review");
    expect(r.statKey).toBe("benchMax");
  });
});
