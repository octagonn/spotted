/**
 * Seed rarity percentages — the percent of users who have earned each EXACT
 * trophy or tier. These are modeled initial estimates, keyed so they're trivial
 * to replace with live backend numbers later (the trophy_rarity() RPC overrides
 * any key it returns; see hooks/queries/useTrophyRarity).
 *
 * Keys:
 *   standalone trophy → its id  (e.g. "day-one")
 *   stacked tier      → `${trophyId}:${tierValue}`  (e.g. "bench:225")
 *
 * Strength anchors follow published strength-standard distributions for
 * gym-going men (e.g. 225 bench ≈ 30% of male gym-goers, 315 ≈ 5%, 405 < 1%,
 * 500 < 0.1%); the same falling-curve methodology is applied to squat,
 * deadlift, pull-ups, and push-ups. Behavioral trophies use modeled estimates.
 *
 * The UI always shows the exact seeded number ("30.0% of users"), never a
 * bucket word or an approximate range.
 */

export const TROPHY_RARITY_SEEDS: Record<string, number> = {
  // ── Strength (video-verified) ──────────────────────────────────────────────
  // Bench
  "bench:135": 84,
  "bench:185": 55,
  "bench:205": 42,
  "bench:225": 30,
  "bench:275": 12.5,
  "bench:315": 5,
  "bench:365": 1.8,
  "bench:405": 0.8,
  "bench:500": 0.08,
  // Squat
  "squat:135": 80,
  "squat:185": 52,
  "squat:225": 35,
  "squat:275": 18,
  "squat:315": 8,
  "squat:365": 3,
  "squat:405": 1.2,
  "squat:455": 0.5,
  "squat:500": 0.2,
  // Deadlift
  "deadlift:135": 82,
  "deadlift:225": 40,
  "deadlift:275": 26,
  "deadlift:315": 15,
  "deadlift:365": 7,
  "deadlift:405": 3.5,
  "deadlift:455": 1.5,
  "deadlift:500": 0.7,
  "deadlift:585": 0.15,
  // Pull-ups
  "pullups:5": 70,
  "pullups:10": 42,
  "pullups:15": 22,
  "pullups:20": 11,
  "pullups:25": 5,
  "pullups:30": 2.4,
  "pullups:40": 0.7,
  "pullups:50": 0.2,
  // Push-ups
  "pushups:25": 75,
  "pushups:50": 45,
  "pushups:75": 24,
  "pushups:100": 12,
  "pushups:150": 3.5,
  "pushups:200": 0.8,

  // ── Time of Day (geoverified check-ins) ────────────────────────────────────
  "tequila-sunrise": 6,
  "dark-night": 15,
  "rush-hour": 48,
  nomad: 0.5,

  // ── Dedication ─────────────────────────────────────────────────────────────
  "dirty-doubles": 12,
  "two-gyms": 4,
  "triple-threat": 1.2,

  // ── Streaks ────────────────────────────────────────────────────────────────
  "streaks:7": 40,
  "streaks:14": 26,
  "streaks:21": 17,
  "streaks:30": 11,
  "streaks:60": 4.5,
  "streaks:100": 1.8,
  "streaks:365": 0.3,

  // ── Weekend Warrior ────────────────────────────────────────────────────────
  "weekend-warrior:4": 35,
  "weekend-warrior:8": 22,
  "weekend-warrior:16": 12,
  "weekend-warrior:26": 6,
  "weekend-warrior:52": 2,

  // ── Holidays ───────────────────────────────────────────────────────────────
  "new-year-same-me": 15,
  heartbreaker: 8,
  "liftin-lucky": 6,
  "weight-is-risen": 5,
  "american-made": 12,
  "scary-strong": 9,
  "turkey-bowl": 11,
  "jingle-dumbells": 7,
  repsolution: 14,

  // ── Home Turf ──────────────────────────────────────────────────────────────
  "home-turf:25": 30,
  "home-turf:50": 18,
  "home-turf:100": 9,
  "home-turf:250": 3,
  "home-turf:500": 0.8,

  // ── Firsts ─────────────────────────────────────────────────────────────────
  "day-one": 95,
  "first-crew": 40
};

/** Trophies held by fewer than this % get a subtle premium treatment. */
export const PREMIUM_RARITY_THRESHOLD = 1;

/** Rarity key for a standalone trophy or a specific stacked tier. */
export function rarityKey(trophyId: string, tierValue?: number): string {
  return tierValue == null ? trophyId : `${trophyId}:${tierValue}`;
}

/**
 * Percent of users who earned the exact trophy/tier. Once the live map has
 * loaded (`__loaded` sentinel from useTrophyRarity), it is the ONLY source of
 * truth: a key with no live row means zero users hold it — never a modeled
 * estimate. The seeds only cover the brief pre-load / offline window so cards
 * don't flash 0% on a cold open.
 */
export function rarityPctFor(key: string, live?: Record<string, number>): number {
  const pct = live?.__loaded ? live[key] ?? 0 : live?.[key] ?? TROPHY_RARITY_SEEDS[key] ?? 25;
  return Math.max(0, Math.min(100, pct));
}

/** "30.0% of users" — the canonical rarity string used everywhere in the UI. */
export function formatRarity(pct: number): string {
  if (pct <= 0) return "No one has this yet";
  const rounded = pct < 10 ? Math.round(pct * 10) / 10 : Math.round(pct);
  return `${rounded}% of users`;
}
