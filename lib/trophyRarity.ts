/**
 * Trophy rarity — how rare a trophy is, expressed as the percentage of Spotted
 * users who have earned it. The live percentages come from `trophy_rarity()`
 * (see hooks/queries/useTrophyRarity + the trophy_rarity migration), computed
 * across ALL users. Until that data exists for a trophy we fall back to the
 * seed estimates below so the case always shows a rarity label.
 *
 * Buckets (by % of users who hold it):
 *   Common     > 25%
 *   Uncommon   5 – 25%
 *   Rare       1 – 5%
 *   Legendary  < 1%
 */

import { colors } from "@/theme/colors";

export type RarityLabel = "Common" | "Uncommon" | "Rare" | "Legendary";

export type Rarity = {
  /** Percent of users who hold this trophy (0–100). */
  pct: number;
  label: RarityLabel;
};

export function rarityLabelForPct(pct: number): RarityLabel {
  if (pct < 1) return "Legendary";
  if (pct < 5) return "Rare";
  if (pct <= 25) return "Uncommon";
  return "Common";
}

/** Text color for a rarity label — monochrome ladder, gold reserved for the rarest. */
export function rarityColor(label: RarityLabel): string {
  switch (label) {
    case "Legendary":
      return colors.gold;
    case "Rare":
      return colors.bone;
    case "Uncommon":
      return colors.silver;
    default:
      return colors.fog;
  }
}

/** A short, human "3% of lifters" style line. Rounds sensibly for tiny values. */
export function rarityBlurb(pct: number): string {
  const rounded = pct < 1 ? Math.round(pct * 10) / 10 : Math.round(pct);
  return `${rounded}% of lifters`;
}

export function makeRarity(pct: number): Rarity {
  const clamped = Math.max(0, Math.min(100, pct));
  return { pct: clamped, label: rarityLabelForPct(clamped) };
}

/**
 * Seed rarity per trophy id (percent of users) — used only until real app-wide
 * numbers land from `trophy_rarity()`. Rough by design; the live RPC overrides
 * any id it returns. Stacked trophies (bench/streaks/…) key on earning the
 * trophy at all (its first tier).
 */
export const SEED_RARITY: Record<string, number> = {
  // Strength — earning the first tier is common; the high tiers are rare, but
  // rarity here is per-trophy (holding it at all).
  bench: 58,
  squat: 54,
  deadlift: 49,
  pullups: 34,
  pushups: 44,
  // Time of day
  "tequila-sunrise": 8,
  "dark-night": 17,
  "rush-hour": 46,
  nomad: 2,
  // Dedication
  "dirty-doubles": 12,
  "two-gyms": 4,
  "triple-threat": 1.4,
  // Streaks / weekend / home turf (per-trophy: earned any tier)
  streaks: 53,
  "weekend-warrior": 21,
  "home-turf": 29,
  // Holidays
  "ny-same-me": 20,
  "cupids-pump": 9,
  "lucky-lifts": 7,
  "egg-day": 6,
  "grill-grind": 14,
  "spooky-squats": 8,
  "turkey-day": 11,
  "sleigh-all-day": 10,
  repsolution: 12,
  // Firsts
  "day-one": 82,
  "first-crew": 39
};

/** Rarity for a trophy id, preferring live app-wide data over the seed. */
export function rarityForTrophy(id: string, live?: Record<string, number>): Rarity {
  const pct = live?.[id] ?? SEED_RARITY[id] ?? 50;
  return makeRarity(pct);
}
