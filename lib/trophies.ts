import { rarityKey, rarityPctFor, TROPHY_RARITY_SEEDS } from "@/lib/trophyRaritySeeds";

/**
 * Trophy catalog — now DATA, not code. The server's `trophy_definitions`
 * table is the source of truth (adding a trophy is an insert there); this
 * module holds the client shape plus a registry that `useTrophyCatalog`
 * fills once the rows load. Everything downstream (selectors, cards, ladders,
 * share card) reads the registry exactly as it read the old hardcoded list.
 */

export type TrophyCategory =
  | "streak"
  | "total_checkins"
  | "comeback"
  | "community"
  | "milestone"
  | "pr"
  | "novelty"
  | "social";

export const CATEGORY_ORDER: TrophyCategory[] = [
  "streak",
  "total_checkins",
  "pr",
  "comeback",
  "community",
  "milestone",
  "novelty",
  "social"
];

export const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  streak: "Streaks",
  total_checkins: "Check-ins",
  comeback: "Comebacks",
  community: "Community",
  milestone: "Milestones",
  pr: "Personal Records",
  novelty: "Novelty",
  social: "Social"
};

/** Medal tier (spec §Tier system). Null for non-tiered trophies. */
export type TrophyMedal = "bronze" | "silver" | "gold" | "diamond";

export const MEDAL_ORDER: TrophyMedal[] = ["bronze", "silver", "gold", "diamond"];

export const MEDAL_LABELS: Record<TrophyMedal, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond"
};

export type TrackingType = "automatic" | "progress" | "dateBased";
export type VerificationType = "automatic" | "date";

export type TrophyTier = {
  /** Definition key (e.g. "streak_silver", "bench:225"). */
  id: string;
  value: number;
  name: string;
  requirement: string;
  rarityPct: number;
  medal?: TrophyMedal | null;
  description?: string;
};

export type TrophyDefinition = {
  /** Family id for stacked ladders (e.g. "streak"), definition key for standalones. */
  id: string;
  category: TrophyCategory;
  name: string;
  description: string;
  requirement: string;
  icon: string;
  type: "stacked" | "standalone";
  trackingType: TrackingType;
  statKey?: string;
  progressStatKey?: string;
  unit?: string;
  tiers?: TrophyTier[];
  rarityPct?: number;
  medal?: TrophyMedal | null;
  /** Re-awardable (comeback, monthly top-of-gym): one earned row per instance. */
  repeatable?: boolean;
};

export type TrophyAchievement = {
  achievementId: string;
  trophyId: string;
  tierId: number | null;
  earnedAt: string;
  verificationType: VerificationType;
  verificationReference: string | null;
  /** Instance context for repeatable trophies (gym, month, run start). */
  context?: Record<string, unknown> | null;
};

export type TrophyProgress = {
  trophyId: string;
  currentValue: number;
  targetValue: number;
  updatedAt: string;
  /** Name of the tier the bar is climbing toward ("Silver"). */
  nextTierName?: string | null;
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/** Filled by useTrophyCatalog from trophy_definitions. Empty until loaded. */
export let TROPHIES: TrophyDefinition[] = [];
export let TROPHIES_BY_ID: Record<string, TrophyDefinition> = {};

export function setTrophyCatalog(defs: TrophyDefinition[]): void {
  TROPHIES = defs;
  TROPHIES_BY_ID = Object.fromEntries(defs.map((d) => [d.id, d]));
}

export function tierRarityPct(trophyId: string, tierValue: number | null, live?: Record<string, number>): number {
  return rarityPctFor(rarityKey(trophyId, tierValue ?? undefined), live);
}

export const RARITY_SEED_KEYS = Object.keys(TROPHY_RARITY_SEEDS);

// ─── Server row → client definition ───────────────────────────────────────────

export type TrophyDefinitionRow = {
  id: string;
  key: string;
  category: TrophyCategory;
  tier: TrophyMedal | null;
  name: string;
  description: string;
  icon: string;
  rule_type: "threshold" | "event" | "calendar" | "composite";
  rule_params: Record<string, unknown> | null;
  family: string | null;
  sort: number;
  repeatable: boolean;
  active: boolean;
};

const FAMILY_LABELS: Record<string, string> = {
  streak: "Streak",
  checkins: "Check-ins",
  bench: "Bench",
  squat: "Squat",
  deadlift: "Deadlift",
  pullups: "Pull-ups",
  pushups: "Push-ups",
  run: "Running"
};

const FAMILY_UNITS: Record<string, string> = {
  streak: "days",
  checkins: "check-ins",
  bench: "lb",
  squat: "lb",
  deadlift: "lb",
  pullups: "reps",
  pushups: "reps",
  run: "s"
};

const FAMILY_ICONS: Record<string, string> = {
  streak: "flame",
  checkins: "map-pin",
  bench: "dumbbell",
  squat: "dumbbell",
  deadlift: "dumbbell",
  pullups: "activity",
  pushups: "activity",
  run: "timer"
};

function num(v: unknown): number {
  return typeof v === "number" ? v : typeof v === "string" ? Number(v) || 0 : 0;
}

/**
 * Group rows into the client catalog: rows sharing `family` become one
 * stacked definition (tiers ordered by threshold), everything else a
 * standalone. Rarity is stamped from the live map when available.
 */
export function buildTrophyCatalog(rows: TrophyDefinitionRow[], live?: Record<string, number>): TrophyDefinition[] {
  const active = rows.filter((r) => r.active).sort((a, b) => a.sort - b.sort);
  const families = new Map<string, TrophyDefinitionRow[]>();
  const standalones: TrophyDefinitionRow[] = [];
  for (const r of active) {
    if (r.family && r.rule_type === "threshold") {
      const list = families.get(r.family) ?? [];
      list.push(r);
      families.set(r.family, list);
    } else {
      standalones.push(r);
    }
  }
  const out: TrophyDefinition[] = [];
  for (const [family, list] of families) {
    const tiers: TrophyTier[] = list
      .map((r) => ({ r, value: num(r.rule_params?.value) }))
      .sort((a, b) => a.value - b.value)
      .map(({ r, value }) => ({
        id: r.key,
        value,
        name: r.name,
        requirement: `${value} ${FAMILY_UNITS[family] ?? ""}`.trim(),
        rarityPct: rarityPctFor(rarityKey(family, value), live),
        medal: r.tier,
        description: r.description
      }));
    const first = list[0];
    out.push({
      id: family,
      category: first.category,
      name: FAMILY_LABELS[family] ?? first.name,
      description: first.description,
      requirement: tiers[0]?.requirement ?? "",
      icon: FAMILY_ICONS[family] ?? first.icon,
      type: "stacked",
      trackingType: "progress",
      statKey: String(first.rule_params?.metric ?? family),
      unit: FAMILY_UNITS[family],
      tiers,
      medal: null
    });
  }
  for (const r of standalones) {
    const target = r.rule_type === "threshold" ? num(r.rule_params?.value) : null;
    out.push({
      id: r.key,
      category: r.category,
      name: r.name,
      description: r.description,
      requirement: r.description,
      icon: r.icon,
      type: "standalone",
      trackingType: r.rule_type === "threshold" && target && target > 1 ? "progress" : r.rule_type === "calendar" ? "dateBased" : "automatic",
      statKey: r.rule_type === "threshold" ? String(r.rule_params?.metric ?? "") : undefined,
      rarityPct: rarityPctFor(rarityKey(r.key), live),
      medal: r.tier,
      repeatable: r.repeatable
    });
  }
  // Category order first, then server sort.
  const catIndex = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  const sortOf = new Map<string, number>();
  for (const r of active) sortOf.set(r.family && r.rule_type === "threshold" ? r.family : r.key, Math.min(sortOf.get(r.family ?? r.key) ?? Infinity, r.sort));
  return out.sort(
    (a, b) => (catIndex.get(a.category) ?? 99) - (catIndex.get(b.category) ?? 99) || (sortOf.get(a.id) ?? 0) - (sortOf.get(b.id) ?? 0)
  );
}
