/**
 * Trophy system — pure definitions + evaluation. No React/RN imports so it
 * stays unit-testable and cheap to reason about. UI (icons, colors) resolves
 * `iconKey` separately in components/trophies/TrophyIcon.
 *
 * Two shapes:
 *  - stacked:    one card with a tier ladder; the card shows the highest tier
 *                earned, the detail sheet shows the whole ladder.
 *  - standalone: a single earn/locked badge (optionally progress-trackable,
 *                e.g. Nomad 0/24).
 */

export type TrophyCategory =
  | "strength"
  | "time-of-day"
  | "dedication"
  | "streaks"
  | "weekend-warrior"
  | "holidays"
  | "home-turf"
  | "firsts";

export const CATEGORY_ORDER: TrophyCategory[] = [
  "strength",
  "time-of-day",
  "dedication",
  "streaks",
  "weekend-warrior",
  "holidays",
  "home-turf",
  "firsts"
];

export const CATEGORY_LABELS: Record<TrophyCategory, string> = {
  strength: "Strength",
  "time-of-day": "Time of Day",
  dedication: "Dedication",
  streaks: "Streaks",
  "weekend-warrior": "Weekend Warrior",
  holidays: "Holidays",
  "home-turf": "Home Turf",
  firsts: "Firsts"
};

export type TierDef = { threshold: number; label: string };

export type StackedTrophyDef = {
  kind: "stacked";
  id: string;
  category: TrophyCategory;
  name: string;
  iconKey: string;
  /** Numeric stat that unlocks tiers (best-ever value). */
  statKey: string;
  /** Stat that drives "progress toward next" when it differs from statKey (e.g. current streak). */
  progressStatKey?: string;
  unit?: string;
  /** true when tier labels are names (Week One) rather than the threshold itself. */
  named: boolean;
  tiers: TierDef[];
  /** Show a progress bar/count even while locked. */
  trackable?: boolean;
  /** "video" = tiers only count once a max-lift video is verified (no auto-earn, no progress bar). */
  verify?: "video";
};

export type StandaloneTrophyDef = {
  kind: "standalone";
  id: string;
  category: TrophyCategory;
  name: string;
  iconKey: string;
  /** Short locked-state copy. */
  requirement: string;
  /** Progress-trackable standalone (Nomad): earns when the stat hits target. */
  progress?: { statKey: string; target: number; unit?: string };
};

export type TrophyDef = StackedTrophyDef | StandaloneTrophyDef;

// ─── Definitions ────────────────────────────────────────────────────────────

function weightTiers(values: number[]): TierDef[] {
  return values.map((v) => ({ threshold: v, label: String(v) }));
}

const STRENGTH: StackedTrophyDef[] = [
  { kind: "stacked", id: "bench", category: "strength", name: "Bench", iconKey: "dumbbell", statKey: "benchMax", unit: "lb", named: false, verify: "video", tiers: weightTiers([135, 185, 205, 225, 275, 315, 365, 405, 500]) },
  { kind: "stacked", id: "squat", category: "strength", name: "Squat", iconKey: "dumbbell", statKey: "squatMax", unit: "lb", named: false, verify: "video", tiers: weightTiers([135, 185, 225, 275, 315, 365, 405, 455, 500]) },
  { kind: "stacked", id: "deadlift", category: "strength", name: "Deadlift", iconKey: "dumbbell", statKey: "deadliftMax", unit: "lb", named: false, verify: "video", tiers: weightTiers([135, 225, 275, 315, 365, 405, 455, 500, 585]) },
  { kind: "stacked", id: "pullups", category: "strength", name: "Pull-ups", iconKey: "chevrons-up", statKey: "pullupMax", unit: "reps", named: false, verify: "video", tiers: weightTiers([5, 10, 15, 20, 25, 30, 40, 50]) },
  { kind: "stacked", id: "pushups", category: "strength", name: "Push-ups", iconKey: "arrow-down-up", statKey: "pushupMax", unit: "reps", named: false, verify: "video", tiers: weightTiers([25, 50, 75, 100, 150, 200]) }
];

const TIME_OF_DAY: StandaloneTrophyDef[] = [
  { kind: "standalone", id: "tequila-sunrise", category: "time-of-day", name: "Tequila Sunrise", iconKey: "sunrise", requirement: "Check in before 5 AM" },
  { kind: "standalone", id: "dark-night", category: "time-of-day", name: "Dark Night", iconKey: "moon", requirement: "Check in after 10 PM" },
  { kind: "standalone", id: "rush-hour", category: "time-of-day", name: "Rush Hour", iconKey: "sunset", requirement: "Check in 5–7 PM" },
  { kind: "standalone", id: "nomad", category: "time-of-day", name: "Nomad", iconKey: "globe", requirement: "Check in across all 24 hours", progress: { statKey: "nomadHours", target: 24, unit: "hrs" } }
];

const DEDICATION: StandaloneTrophyDef[] = [
  { kind: "standalone", id: "dirty-doubles", category: "dedication", name: "Dirty Doubles", iconKey: "repeat", requirement: "Two visits in one day" },
  { kind: "standalone", id: "two-gyms", category: "dedication", name: "Are You Cheating On Me?", iconKey: "split", requirement: "Two different gyms in one day" },
  { kind: "standalone", id: "triple-threat", category: "dedication", name: "Triple Threat", iconKey: "layers", requirement: "Three gyms in one day" }
];

const STREAKS: StackedTrophyDef = {
  kind: "stacked",
  id: "streaks",
  category: "streaks",
  name: "Streak",
  iconKey: "flame",
  statKey: "streakBest",
  progressStatKey: "streakCurrent",
  unit: "days",
  named: true,
  trackable: true,
  tiers: [
    { threshold: 7, label: "Week One" },
    { threshold: 14, label: "Two Weeks Deep" },
    { threshold: 21, label: "Habit Formed" },
    { threshold: 30, label: "The Month" },
    { threshold: 60, label: "Sixty" },
    { threshold: 100, label: "Century Club" },
    { threshold: 365, label: "Year of Iron" }
  ]
};

const WEEKEND_WARRIOR: StackedTrophyDef = {
  kind: "stacked",
  id: "weekend-warrior",
  category: "weekend-warrior",
  name: "Weekend Warrior",
  iconKey: "swords",
  statKey: "weekendStreak",
  unit: "weekends",
  named: true,
  trackable: true,
  tiers: [
    { threshold: 4, label: "I" },
    { threshold: 8, label: "II" },
    { threshold: 16, label: "III" },
    { threshold: 26, label: "IV" },
    { threshold: 52, label: "V" }
  ]
};

const HOLIDAYS: StandaloneTrophyDef[] = [
  { kind: "standalone", id: "ny-same-me", category: "holidays", name: "New Year, Same Me", iconKey: "sparkles", requirement: "Check in Jan 1" },
  { kind: "standalone", id: "cupids-pump", category: "holidays", name: "Cupid's Pump", iconKey: "heart", requirement: "Check in Feb 14" },
  { kind: "standalone", id: "lucky-lifts", category: "holidays", name: "Lucky Lifts", iconKey: "clover", requirement: "Check in Mar 17" },
  { kind: "standalone", id: "egg-day", category: "holidays", name: "Egg Day Gains", iconKey: "egg", requirement: "Check in on Easter" },
  { kind: "standalone", id: "grill-grind", category: "holidays", name: "Grill & Grind", iconKey: "flame", requirement: "Check in Jul 4" },
  { kind: "standalone", id: "spooky-squats", category: "holidays", name: "Spooky Scary Squats", iconKey: "ghost", requirement: "Check in Oct 31" },
  { kind: "standalone", id: "turkey-day", category: "holidays", name: "Turkey Day Triumph", iconKey: "drumstick", requirement: "Check in on Thanksgiving" },
  { kind: "standalone", id: "sleigh-all-day", category: "holidays", name: "Sleigh All Day", iconKey: "gift", requirement: "Check in Dec 25" },
  { kind: "standalone", id: "repsolution", category: "holidays", name: "Repsolution", iconKey: "party-popper", requirement: "Check in Dec 31" }
];

const HOME_TURF: StackedTrophyDef = {
  kind: "stacked",
  id: "home-turf",
  category: "home-turf",
  name: "Home Turf",
  iconKey: "home",
  statKey: "homeGymVisits",
  unit: "visits",
  named: true,
  trackable: true,
  tiers: [
    { threshold: 25, label: "Regular" },
    { threshold: 50, label: "Local" },
    { threshold: 100, label: "Fixture" },
    { threshold: 250, label: "Landmark" },
    { threshold: 500, label: "They Named a Bench After You" }
  ]
};

const FIRSTS: StandaloneTrophyDef[] = [
  { kind: "standalone", id: "day-one", category: "firsts", name: "Day One", iconKey: "flag", requirement: "Share your first post" },
  { kind: "standalone", id: "first-crew", category: "firsts", name: "First Crew", iconKey: "users", requirement: "Join or create a crew" }
];

export const TROPHIES: TrophyDef[] = [
  ...STRENGTH,
  ...TIME_OF_DAY,
  ...DEDICATION,
  STREAKS,
  WEEKEND_WARRIOR,
  ...HOLIDAYS,
  HOME_TURF,
  ...FIRSTS
];

// ─── Stats ───────────────────────────────────────────────────────────────────

export type TrophyStats = {
  /** statKey → best-ever numeric value (lifts, streaks, visit counts, nomad hours). */
  numbers: Record<string, number>;
  /** standalone trophy id → earned. */
  flags: Record<string, boolean>;
  /** trophy id (or `${id}:${threshold}` for a tier) → ISO earn date. */
  dates: Record<string, string>;
};

/** Prototype state: Day One earned, streak at 1, everything else locked. */
export const DEMO_TROPHY_STATS: TrophyStats = {
  numbers: {
    benchMax: 0,
    squatMax: 0,
    deadliftMax: 0,
    pullupMax: 0,
    pushupMax: 0,
    streakBest: 1,
    streakCurrent: 1,
    weekendStreak: 0,
    homeGymVisits: 0,
    nomadHours: 0
  },
  flags: {
    "day-one": true
  },
  dates: {}
};

// ─── Evaluation ──────────────────────────────────────────────────────────────

export type EvaluatedTier = { tier: TierDef; earned: boolean; isNext: boolean; date?: string };

export type EvaluatedTrophy = {
  def: TrophyDef;
  earned: boolean;
  earnedCount: number;
  total: number;
  highestTier?: TierDef;
  nextTier?: TierDef;
  progress?: { current: number; target: number; unit?: string };
  earnedDate?: string;
  tiers?: EvaluatedTier[];
};

export type TrophyGroup = { category: TrophyCategory; label: string; trophies: EvaluatedTrophy[] };

export function tierPrimary(def: StackedTrophyDef, tier: TierDef): string {
  return def.named ? tier.label : `${tier.threshold}${def.unit ? ` ${def.unit}` : ""}`;
}

export function tierSecondary(def: StackedTrophyDef, tier: TierDef): string | undefined {
  return def.named ? `${tier.threshold} ${def.unit ?? ""}`.trim() : undefined;
}

export function evaluateTrophy(def: TrophyDef, stats: TrophyStats): EvaluatedTrophy {
  if (def.kind === "stacked") {
    const value = stats.numbers[def.statKey] ?? 0;
    const progressValue = stats.numbers[def.progressStatKey ?? def.statKey] ?? value;
    let earnedCount = 0;
    const tiers: EvaluatedTier[] = def.tiers.map((tier) => {
      const earned = value >= tier.threshold;
      if (earned) earnedCount += 1;
      return { tier, earned, isNext: false, date: stats.dates[`${def.id}:${tier.threshold}`] };
    });
    const nextIndex = earnedCount < def.tiers.length ? earnedCount : -1;
    if (nextIndex >= 0) tiers[nextIndex].isNext = true;
    const highestTier = earnedCount > 0 ? def.tiers[earnedCount - 1] : undefined;
    const nextTier = nextIndex >= 0 ? def.tiers[nextIndex] : undefined;
    const target = nextTier ? nextTier.threshold : highestTier?.threshold ?? 0;
    return {
      def,
      earned: earnedCount > 0,
      earnedCount,
      total: def.tiers.length,
      highestTier,
      nextTier,
      progress: def.trackable || earnedCount > 0 ? { current: progressValue, target, unit: def.unit } : { current: progressValue, target, unit: def.unit },
      earnedDate: highestTier ? stats.dates[`${def.id}:${highestTier.threshold}`] : undefined,
      tiers
    };
  }

  // standalone
  if (def.progress) {
    const current = stats.numbers[def.progress.statKey] ?? 0;
    const earned = current >= def.progress.target;
    return {
      def,
      earned,
      earnedCount: earned ? 1 : 0,
      total: 1,
      progress: { current: Math.min(current, def.progress.target), target: def.progress.target, unit: def.progress.unit },
      earnedDate: earned ? stats.dates[def.id] : undefined
    };
  }

  const earned = stats.flags[def.id] === true;
  return {
    def,
    earned,
    earnedCount: earned ? 1 : 0,
    total: 1,
    earnedDate: earned ? stats.dates[def.id] : undefined
  };
}

export function evaluateGroups(stats: TrophyStats): TrophyGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    trophies: TROPHIES.filter((t) => t.category === category).map((t) => evaluateTrophy(t, stats))
  }));
}

/** Count of top-level earned trophies (drives the profile "Trophies" stat). */
export function earnedTrophyCount(stats: TrophyStats): number {
  return TROPHIES.reduce((sum, def) => sum + (evaluateTrophy(def, stats).earned ? 1 : 0), 0);
}
