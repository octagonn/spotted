import { describe, expect, it } from "vitest";

import { toAchievements, toProgress } from "@/lib/trophyServer";
import { buildTrophyCatalog, type TrophyDefinitionRow } from "@/lib/trophies";

const row = (over: Partial<TrophyDefinitionRow>): TrophyDefinitionRow => ({
  id: over.key ?? "x",
  key: "x",
  category: "novelty",
  tier: null,
  name: "X",
  description: "",
  icon: "trophy",
  rule_type: "event",
  rule_params: {},
  family: null,
  sort: 0,
  repeatable: false,
  active: true,
  ...over
});

const ROWS: TrophyDefinitionRow[] = [
  row({ key: "streak_bronze", category: "streak", tier: "bronze", name: "7-Day Streak", rule_type: "threshold", rule_params: { metric: "streak_best", value: 7 }, family: "streak", sort: 10 }),
  row({ key: "streak_silver", category: "streak", tier: "silver", name: "30-Day Streak", rule_type: "threshold", rule_params: { metric: "streak_best", value: 30 }, family: "streak", sort: 11 }),
  row({ key: "early_bird", category: "novelty", name: "Early Bird", rule_type: "calendar", rule_params: { kind: "hour_before", hour: 6 }, sort: 60 }),
  row({ key: "comeback", category: "comeback", name: "Comeback", rule_type: "event", rule_params: { kind: "comeback" }, sort: 30, repeatable: true }),
  row({ key: "retired", category: "novelty", name: "Retired", active: false })
];

describe("buildTrophyCatalog", () => {
  it("stacks same-family threshold rows into one ladder ordered by value, and skips inactive rows", () => {
    const catalog = buildTrophyCatalog(ROWS, { __loaded: 1, "streak:7": 40, "streak:30": 5 });
    const streak = catalog.find((d) => d.id === "streak");
    expect(streak?.type).toBe("stacked");
    expect(streak?.tiers?.map((t) => [t.id, t.value, t.medal, t.rarityPct])).toEqual([
      ["streak_bronze", 7, "bronze", 40],
      ["streak_silver", 30, "silver", 5]
    ]);
    expect(catalog.find((d) => d.id === "early_bird")?.trackingType).toBe("dateBased");
    expect(catalog.find((d) => d.id === "comeback")?.repeatable).toBe(true);
    expect(catalog.some((d) => d.id === "retired")).toBe(false);
  });

  it("orders by category then server sort", () => {
    const ids = buildTrophyCatalog(ROWS).map((d) => d.id);
    expect(ids).toEqual(["streak", "comeback", "early_bird"]);
  });
});

describe("earned rows → achievements → progress", () => {
  const rowByKey = new Map(ROWS.map((r) => [r.key, r]));
  const catalog = buildTrophyCatalog(ROWS);

  it("maps a tier row to its family + value, and repeatable instances stay distinct", () => {
    const ach = toAchievements(
      [
        { trophy_id: "streak_bronze", tier: 1, earned_at: "2026-08-01T00:00:00Z", instance_key: "", context: null, celebrated_at: null },
        { trophy_id: "comeback", tier: null, earned_at: "2026-08-02T00:00:00Z", instance_key: "2026-07-01", context: { run_len: 9 }, celebrated_at: null },
        { trophy_id: "comeback", tier: null, earned_at: "2026-08-20T00:00:00Z", instance_key: "2026-08-10", context: null, celebrated_at: null },
        { trophy_id: "unknown_key", tier: null, earned_at: "2026-08-20T00:00:00Z", instance_key: "", context: null, celebrated_at: null }
      ],
      rowByKey
    );
    expect(ach.map((a) => [a.trophyId, a.tierId, a.achievementId])).toEqual([
      ["streak", 7, "streak_bronze"],
      ["comeback", null, "comeback#2026-07-01"],
      ["comeback", null, "comeback#2026-08-10"]
    ]);
  });

  it("points the family progress bar at the first unearned tier", () => {
    const ach = toAchievements(
      [{ trophy_id: "streak_bronze", tier: 1, earned_at: "2026-08-01T00:00:00Z", instance_key: "", context: null, celebrated_at: null }],
      rowByKey
    );
    const progress = toProgress(
      [
        { key: "streak_bronze", current: 23, target: 7 },
        { key: "streak_silver", current: 23, target: 30 }
      ],
      catalog,
      ach
    );
    expect(progress).toEqual([
      expect.objectContaining({ trophyId: "streak", currentValue: 23, targetValue: 30, nextTierName: "30-Day Streak" })
    ]);
  });
});
