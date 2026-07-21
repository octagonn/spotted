import { describe, expect, it } from "vitest";

import {
  formatRarity,
  PREMIUM_RARITY_THRESHOLD,
  rarityKey,
  rarityPctFor,
  TROPHY_RARITY_SEEDS
} from "@/lib/trophyRaritySeeds";

describe("rarityKey", () => {
  it("keys standalone by id and stacked tiers by id:value", () => {
    expect(rarityKey("day-one")).toBe("day-one");
    expect(rarityKey("bench", 225)).toBe("bench:225");
  });
});

describe("rarityPctFor", () => {
  it("prefers live app-wide data over the seed", () => {
    expect(rarityPctFor("nomad")).toBe(TROPHY_RARITY_SEEDS.nomad);
    expect(rarityPctFor("nomad", { nomad: 0.4 })).toBe(0.4);
  });

  it("clamps out-of-range values", () => {
    expect(rarityPctFor("x", { x: -5 })).toBe(0);
    expect(rarityPctFor("x", { x: 250 })).toBe(100);
  });

  it("falls back to a conservative default for unseeded keys", () => {
    expect(rarityPctFor("does-not-exist")).toBe(25);
  });

  it("uses strength-standard anchors (225 bench ~30%, 315 ~5%, 405 <1%, 500 <0.1%)", () => {
    expect(rarityPctFor("bench:225")).toBe(30);
    expect(rarityPctFor("bench:315")).toBe(5);
    expect(rarityPctFor("bench:405")).toBeLessThan(1);
    expect(rarityPctFor("bench:500")).toBeLessThan(0.1);
  });
});

describe("formatRarity", () => {
  it("always shows a numeric % of users, one decimal under 10%", () => {
    expect(formatRarity(0.4)).toBe("0.4% of users");
    expect(formatRarity(4.8)).toBe("4.8% of users");
    expect(formatRarity(32.4)).toBe("32% of users");
  });
});

describe("premium threshold", () => {
  it("marks sub-1% trophies as premium", () => {
    expect(rarityPctFor("bench:500") < PREMIUM_RARITY_THRESHOLD).toBe(true);
    expect(rarityPctFor("day-one") < PREMIUM_RARITY_THRESHOLD).toBe(false);
  });
});
