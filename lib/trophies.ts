/**
 * Trophy system — definitions + the achievement data model. No React/RN imports
 * so it stays unit-testable. UI resolves icons/colors separately.
 *
 * Model (per spec):
 *  - TrophyDefinition: a family (stacked) or a single badge (standalone).
 *  - TrophyTier:       one rung of a stacked family, with its own rarityPct.
 *  - TrophyAchievement: an earned record — every earned tier is its own record
 *                       with its own earnedAt, so tiers keep separate dates.
 *  - TrophyProgress:   current progress toward the next automatic target.
 *
 * The highest earned tier is DERIVED from achievements, never stored on the def.
 */

import { rarityKey, rarityPctFor, TROPHY_RARITY_SEEDS } from "@/lib/trophyRaritySeeds";

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

export type TrackingType = "automatic" | "progress" | "videoVerification" | "dateBased";
export type VerificationType = "automatic" | "video" | "date";

export type TrophyTier = {
  id: string;
  value: number;
  name: string;
  requirement: string;
  rarityPct: number;
};

export type TrophyDefinition = {
  id: string;
  category: TrophyCategory;
  name: string;
  description: string;
  requirement: string;
  icon: string;
  type: "stacked" | "standalone";
  trackingType: TrackingType;
  /** Stat key this trophy reads from TrophyStats (progress + auto-earn). */
  statKey?: string;
  /** For "progress" trophies, the stat that drives the live bar (e.g. current streak). */
  progressStatKey?: string;
  unit?: string;
  tiers?: TrophyTier[];
  /** Standalone rarity (stacked rarity lives per-tier). */
  rarityPct?: number;
};

export type TrophyAchievement = {
  achievementId: string;
  trophyId: string;
  /** Tier value for stacked; null for standalone. */
  tierId: number | null;
  earnedAt: string;
  verificationType: VerificationType;
  verificationReference: string | null;
};

export type TrophyProgress = {
  trophyId: string;
  currentValue: number;
  targetValue: number;
  updatedAt: string;
};

// ─── Catalog builders ─────────────────────────────────────────────────────────

/** Build named strength tiers ([value, name]) — all video-verified. */
function tiers(trophyId: string, rows: [number, string][]): TrophyTier[] {
  return rows.map(([value, name]) => ({
    id: `${trophyId}-${value}`,
    value,
    name,
    requirement: `Hit ${value}`,
    rarityPct: rarityPctFor(rarityKey(trophyId, value))
  }));
}

/** Build tiers where the requirement is "N unit" (streaks, visits, weekends). */
function countTiers(trophyId: string, unit: string, rows: [number, string][]): TrophyTier[] {
  return rows.map(([value, name]) => ({
    id: `${trophyId}-${value}`,
    value,
    name,
    requirement: `${value} ${unit}`,
    rarityPct: rarityPctFor(rarityKey(trophyId, value))
  }));
}

const standaloneRarity = (id: string) => rarityPctFor(rarityKey(id));

// ─── Strength (video-verified) ─────────────────────────────────────────────────

const STRENGTH: TrophyDefinition[] = [
  {
    id: "bench", category: "strength", name: "Bench", icon: "dumbbell", type: "stacked",
    trackingType: "videoVerification", statKey: "benchMax", unit: "lb",
    description: "Your best verified bench press.", requirement: "Verify a bench press on video.",
    tiers: tiers("bench", [
      [135, "Warming Up"], [185, "Getting Serious"], [205, "Almost There"], [225, "In the Club"],
      [275, "Heavy Hitter"], [315, "Lay of the Roids"], [365, "Freak Strength"], [405, "The 405 Club"], [500, "Titan"]
    ])
  },
  {
    id: "squat", category: "strength", name: "Squat", icon: "dumbbell", type: "stacked",
    trackingType: "videoVerification", statKey: "squatMax", unit: "lb",
    description: "Your best verified back squat.", requirement: "Verify a squat on video.",
    tiers: tiers("squat", [
      [135, "First Steps"], [185, "Chicken Legs"], [225, "Leg Day Believer"], [275, "Quadzilla Jr."],
      [315, "Quads of Steel"], [365, "Squatzilla"], [405, "Four Wheel Drive"], [455, "Earthquake"], [500, "Five Hundred Deep"]
    ])
  },
  {
    id: "deadlift", category: "strength", name: "Deadlift", icon: "dumbbell", type: "stacked",
    trackingType: "videoVerification", statKey: "deadliftMax", unit: "lb",
    description: "Your best verified deadlift.", requirement: "Verify a deadlift on video.",
    tiers: tiers("deadlift", [
      [135, "Baby"], [225, "Picking Things Up"], [275, "Grip It & Rip It"], [315, "Dead Serious"],
      [365, "Back Breaker"], [405, "Four Plate Pull"], [455, "Gravity's Enemy"], [500, "The Five Hundred"], [585, "Kratos"]
    ])
  },
  {
    id: "pullups", category: "strength", name: "Pull-ups", icon: "chevrons-up", type: "stacked",
    trackingType: "videoVerification", statKey: "pullupMax", unit: "reps",
    description: "Your best single verified set of pull-ups.", requirement: "Verify a pull-up set on video.",
    tiers: tiers("pullups", [
      [5, "Hang In There"], [10, "Double Digits"], [15, "Chin Up"], [20, "Bar Owner"],
      [25, "GoArmy.com"], [30, "Anti-Gravity"], [40, "Bird of Prey"], [50, "Air Force One"]
    ])
  },
  {
    id: "pushups", category: "strength", name: "Push-ups", icon: "arrow-down-up", type: "stacked",
    trackingType: "videoVerification", statKey: "pushupMax", unit: "reps",
    description: "Your best single verified set of push-ups.", requirement: "Verify a push-up set on video.",
    tiers: tiers("pushups", [
      [25, "Floor Work"], [50, "Drop & Give Me 50"], [75, "Chest Day Every Day"],
      [100, "Get a Hobby"], [150, "Machine"], [200, "Boot Camp Nightmare"]
    ])
  }
];

// ─── Time of Day ────────────────────────────────────────────────────────────────

const TIME_OF_DAY: TrophyDefinition[] = [
  { id: "tequila-sunrise", category: "time-of-day", name: "Tequila Sunrise", icon: "sunrise", type: "standalone", trackingType: "automatic", statKey: "checkedInBefore5am", description: "An early-morning gym check-in.", requirement: "Check in before 5 AM.", rarityPct: standaloneRarity("tequila-sunrise") },
  { id: "dark-night", category: "time-of-day", name: "Dark Night", icon: "moon", type: "standalone", trackingType: "automatic", statKey: "checkedInAfter10pm", description: "A late-night gym check-in.", requirement: "Check in after 10 PM.", rarityPct: standaloneRarity("dark-night") },
  { id: "rush-hour", category: "time-of-day", name: "Rush Hour", icon: "sunset", type: "standalone", trackingType: "automatic", statKey: "checkedInRushHour", description: "A peak-hours check-in.", requirement: "Check in between 5 PM and 7 PM.", rarityPct: standaloneRarity("rush-hour") },
  { id: "nomad", category: "time-of-day", name: "Nomad", icon: "globe", type: "standalone", trackingType: "progress", statKey: "nomadHours", unit: "hours", description: "Check in during every hour of the day, over time.", requirement: "Check in across all 24 hours.", rarityPct: standaloneRarity("nomad") }
];

// ─── Dedication ─────────────────────────────────────────────────────────────────

const DEDICATION: TrophyDefinition[] = [
  { id: "dirty-doubles", category: "dedication", name: "Dirty Doubles", icon: "repeat", type: "standalone", trackingType: "automatic", statKey: "twoVisitsOneDay", description: "Two gym visits in a single day.", requirement: "Complete two visits in one day.", rarityPct: standaloneRarity("dirty-doubles") },
  { id: "two-gyms", category: "dedication", name: "Are You Cheating On Me?", icon: "split", type: "standalone", trackingType: "automatic", statKey: "twoGymsOneDay", description: "Two different gyms in one day.", requirement: "Check in at two different gyms in one day.", rarityPct: standaloneRarity("two-gyms") },
  { id: "triple-threat", category: "dedication", name: "Triple Threat", icon: "layers", type: "standalone", trackingType: "automatic", statKey: "threeGymsOneDay", description: "Three different gyms in one day.", requirement: "Check in at three different gyms in one day.", rarityPct: standaloneRarity("triple-threat") }
];

// ─── Streaks ────────────────────────────────────────────────────────────────────

const STREAKS: TrophyDefinition = {
  id: "streaks", category: "streaks", name: "Streak", icon: "flame", type: "stacked",
  trackingType: "progress", statKey: "streakBest", progressStatKey: "streakCurrent", unit: "days",
  description: "Consecutive scheduled gym days.", requirement: "Keep your streak alive.",
  tiers: countTiers("streaks", "days", [
    [7, "Rookie"], [14, "Fortnight"], [21, "Shaken, Not Stirred"], [30, "30 for 30"],
    [60, "Senior Citizen"], [100, "Century Club"], [365, "Year of Iron"]
  ])
};

const WEEKEND_WARRIOR: TrophyDefinition = {
  id: "weekend-warrior", category: "weekend-warrior", name: "Weekend Warrior", icon: "swords", type: "stacked",
  trackingType: "progress", statKey: "weekendStreak", unit: "weekends",
  description: "Consecutive weekends with a Fri/Sat/Sun gym day.", requirement: "Hit the gym on the weekend.",
  tiers: countTiers("weekend-warrior", "weekends", [
    [4, "I"], [8, "II"], [16, "III"], [26, "IV"], [52, "V"]
  ])
};

// ─── Holidays (dynamic dates) ────────────────────────────────────────────────────

const HOLIDAYS: TrophyDefinition[] = [
  { id: "new-year-same-me", category: "holidays", name: "New Year, Same Me", icon: "sparkles", type: "standalone", trackingType: "dateBased", statKey: "holiday-new-year-same-me", description: "A New Year's Day check-in.", requirement: "Check in on January 1.", rarityPct: standaloneRarity("new-year-same-me") },
  { id: "heartbreaker", category: "holidays", name: "Heartbreaker", icon: "heart", type: "standalone", trackingType: "dateBased", statKey: "holiday-heartbreaker", description: "A Valentine's Day check-in.", requirement: "Check in on February 14.", rarityPct: standaloneRarity("heartbreaker") },
  { id: "liftin-lucky", category: "holidays", name: "Liftin Lucky", icon: "clover", type: "standalone", trackingType: "dateBased", statKey: "holiday-liftin-lucky", description: "A St. Patrick's Day check-in.", requirement: "Check in on March 17.", rarityPct: standaloneRarity("liftin-lucky") },
  { id: "weight-is-risen", category: "holidays", name: "Weight is Risen", icon: "egg", type: "standalone", trackingType: "dateBased", statKey: "holiday-weight-is-risen", description: "An Easter Sunday check-in.", requirement: "Check in on Easter.", rarityPct: standaloneRarity("weight-is-risen") },
  { id: "american-made", category: "holidays", name: "American Made", icon: "flame", type: "standalone", trackingType: "dateBased", statKey: "holiday-american-made", description: "A Fourth of July check-in.", requirement: "Check in on July 4.", rarityPct: standaloneRarity("american-made") },
  { id: "scary-strong", category: "holidays", name: "Scary Strong", icon: "ghost", type: "standalone", trackingType: "dateBased", statKey: "holiday-scary-strong", description: "A Halloween check-in.", requirement: "Check in on October 31.", rarityPct: standaloneRarity("scary-strong") },
  { id: "turkey-bowl", category: "holidays", name: "Turkey Bowl", icon: "drumstick", type: "standalone", trackingType: "dateBased", statKey: "holiday-turkey-bowl", description: "A Thanksgiving check-in.", requirement: "Check in on Thanksgiving.", rarityPct: standaloneRarity("turkey-bowl") },
  { id: "jingle-dumbells", category: "holidays", name: "Jingle Dumbells", icon: "gift", type: "standalone", trackingType: "dateBased", statKey: "holiday-jingle-dumbells", description: "A Christmas Day check-in.", requirement: "Check in on December 25.", rarityPct: standaloneRarity("jingle-dumbells") },
  { id: "repsolution", category: "holidays", name: "Repsolution", icon: "party-popper", type: "standalone", trackingType: "dateBased", statKey: "holiday-repsolution", description: "A New Year's Eve check-in.", requirement: "Check in on December 31.", rarityPct: standaloneRarity("repsolution") }
];

// ─── Home Turf ──────────────────────────────────────────────────────────────────

const HOME_TURF: TrophyDefinition = {
  id: "home-turf", category: "home-turf", name: "Home Turf", icon: "home", type: "stacked",
  trackingType: "progress", statKey: "homeGymVisits", unit: "visits",
  description: "Visits at your selected home gym.", requirement: "Keep training at your home gym.",
  tiers: countTiers("home-turf", "visits", [
    [25, "Regular"], [50, "Homefield Advantage"], [100, "Locals Only"], [250, "Hometown Hero"], [500, "They Named a Bench After You"]
  ])
};

// ─── Firsts ─────────────────────────────────────────────────────────────────────

const FIRSTS: TrophyDefinition[] = [
  { id: "day-one", category: "firsts", name: "Day One", icon: "flag", type: "standalone", trackingType: "automatic", statKey: "firstPost", description: "Your very first Spotted post.", requirement: "Publish your first valid post.", rarityPct: standaloneRarity("day-one") },
  { id: "first-crew", category: "firsts", name: "First Crew", icon: "users", type: "standalone", trackingType: "automatic", statKey: "firstCrew", description: "Joined or created your first crew.", requirement: "Join or create a crew.", rarityPct: standaloneRarity("first-crew") }
];

export const TROPHIES: TrophyDefinition[] = [
  ...STRENGTH,
  ...TIME_OF_DAY,
  ...DEDICATION,
  STREAKS,
  WEEKEND_WARRIOR,
  ...HOLIDAYS,
  HOME_TURF,
  ...FIRSTS
];

export const TROPHIES_BY_ID: Record<string, TrophyDefinition> = Object.fromEntries(
  TROPHIES.map((t) => [t.id, t])
);

/** Live rarity override for a trophy/tier, preferring backend numbers. */
export function tierRarityPct(trophyId: string, tierValue: number | null, live?: Record<string, number>): number {
  return rarityPctFor(rarityKey(trophyId, tierValue ?? undefined), live);
}

/** Seed map re-exported so callers can inspect coverage without a second import. */
export const RARITY_SEED_KEYS = Object.keys(TROPHY_RARITY_SEEDS);
