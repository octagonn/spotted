import { describe, expect, it } from "vitest";

import {
  makeRarity,
  rarityBlurb,
  rarityForTrophy,
  rarityLabelForPct,
  SEED_RARITY
} from "@/lib/trophyRarity";

describe("rarity buckets", () => {
  it("labels by the spec boundaries (Common >25, Uncommon 5–25, Rare 1–5, Legendary <1)", () => {
    expect(rarityLabelForPct(0.5)).toBe("Legendary");
    expect(rarityLabelForPct(0.99)).toBe("Legendary");
    expect(rarityLabelForPct(1)).toBe("Rare");
    expect(rarityLabelForPct(4.9)).toBe("Rare");
    expect(rarityLabelForPct(5)).toBe("Uncommon");
    expect(rarityLabelForPct(25)).toBe("Uncommon");
    expect(rarityLabelForPct(25.1)).toBe("Common");
    expect(rarityLabelForPct(80)).toBe("Common");
  });
});

describe("makeRarity", () => {
  it("clamps out-of-range percentages", () => {
    expect(makeRarity(-10).pct).toBe(0);
    expect(makeRarity(250).pct).toBe(100);
    expect(makeRarity(120).label).toBe("Common");
  });
});

describe("rarityForTrophy", () => {
  it("prefers live app-wide data over the seed", () => {
    const seeded = rarityForTrophy("nomad");
    expect(seeded.pct).toBe(SEED_RARITY.nomad);
    expect(seeded.label).toBe("Rare");

    const live = rarityForTrophy("nomad", { nomad: 0.4 });
    expect(live.pct).toBe(0.4);
    expect(live.label).toBe("Legendary");
  });

  it("falls back to 50% for unknown ids", () => {
    expect(rarityForTrophy("does-not-exist").pct).toBe(50);
  });
});

describe("rarityBlurb", () => {
  it("keeps one decimal for sub-1% and rounds otherwise", () => {
    expect(rarityBlurb(0.4)).toBe("0.4% of lifters");
    expect(rarityBlurb(12.6)).toBe("13% of lifters");
  });
});
