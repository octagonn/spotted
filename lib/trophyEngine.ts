/**
 * Trophy engine — turns app stats into TrophyAchievement records. Pure and
 * deterministic: a given stats snapshot always yields the same achievements
 * with the same stable ids, so reprocessing the same events never creates
 * duplicate records (idempotent). No React/RN imports.
 */

import {
  TROPHIES,
  type TrophyAchievement,
  type TrophyDefinition,
  type TrophyProgress,
  type VerificationType
} from "@/lib/trophies";

/**
 * Snapshot of everything the engine reads. All time-of-day / streak / holiday /
 * weekend values are expected to already be computed in the user's LOCAL
 * timezone by whoever assembles this (the hook), so the engine stays pure.
 */
export type TrophyStats = {
  /** statKey → best-ever numeric value (lifts, streaks, visits, nomad hours). */
  numbers: Record<string, number>;
  /** event statKey → whether it has ever happened (check-ins, firsts, holidays). */
  flags: Record<string, boolean>;
  /**
   * Earn dates. Key = trophyId (standalone) or `${trophyId}:${tierValue}`
   * (stacked tier). ISO strings. Missing dates fall back to `now` at derive time.
   */
  dates: Record<string, string>;
};

export function emptyStats(): TrophyStats {
  return { numbers: {}, flags: {}, dates: {} };
}

const tierDateKey = (trophyId: string, value: number) => `${trophyId}:${value}`;

function verificationType(def: TrophyDefinition): VerificationType {
  if (def.trackingType === "videoVerification") return "video";
  if (def.trackingType === "dateBased") return "date";
  return "automatic";
}

/**
 * Derive every earned achievement from stats. One record per earned standalone
 * and one record PER earned tier (so each tier keeps its own date). Ordered
 * newest-first by earnedAt.
 */
export function deriveAchievements(stats: TrophyStats, now = new Date().toISOString()): TrophyAchievement[] {
  const out: TrophyAchievement[] = [];

  for (const def of TROPHIES) {
    const vtype = verificationType(def);

    if (def.type === "stacked" && def.tiers) {
      const value = stats.numbers[def.statKey ?? ""] ?? 0;
      for (const tier of def.tiers) {
        if (value >= tier.value) {
          out.push({
            achievementId: `${def.id}:${tier.value}`,
            trophyId: def.id,
            tierId: tier.value,
            earnedAt: stats.dates[tierDateKey(def.id, tier.value)] ?? now,
            verificationType: vtype,
            verificationReference: stats.dates[`${tierDateKey(def.id, tier.value)}:ref`] ?? null
          });
        }
      }
      continue;
    }

    // Standalone: progress-based (value ≥ implicit target) or flag/event.
    let earned = false;
    if (def.trackingType === "progress" && def.statKey) {
      const target = def.tiers?.[0]?.value ?? 24; // nomad = 24 hours
      earned = (stats.numbers[def.statKey] ?? 0) >= target;
    } else if (def.statKey) {
      earned = stats.flags[def.statKey] === true;
    }
    if (earned) {
      out.push({
        achievementId: def.id,
        trophyId: def.id,
        tierId: null,
        earnedAt: stats.dates[def.id] ?? now,
        verificationType: vtype,
        verificationReference: null
      });
    }
  }

  return out.sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

/** Current progress toward the next unearned target, for progress trophies only. */
export function deriveProgress(stats: TrophyStats, updatedAt = new Date().toISOString()): TrophyProgress[] {
  const out: TrophyProgress[] = [];
  for (const def of TROPHIES) {
    if (def.trackingType !== "progress") continue;
    const progressStat = def.progressStatKey ?? def.statKey ?? "";
    const current = stats.numbers[progressStat] ?? 0;
    const bestStat = def.statKey ?? "";
    const best = stats.numbers[bestStat] ?? 0;
    // Next target: first tier value above the best-earned, else the last tier.
    const target =
      def.tiers?.find((t) => t.value > best)?.value ?? def.tiers?.[def.tiers.length - 1]?.value ?? 24;
    out.push({ trophyId: def.id, currentValue: current, targetValue: target, updatedAt });
  }
  return out;
}

// ─── Dynamic holiday dates (local year) ────────────────────────────────────────

/** Western Easter Sunday via the Anonymous Gregorian computus. */
export function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** US Thanksgiving — the fourth Thursday of November. */
export function thanksgivingDate(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  const firstThursdayOffset = (4 - nov1.getDay() + 7) % 7; // 4 = Thursday
  return new Date(year, 10, 1 + firstThursdayOffset + 21);
}

/** Whether a local Date matches a holiday trophy's date for that year. */
export function isHolidayDate(trophyId: string, date: Date): boolean {
  const y = date.getFullYear();
  const md = (m: number, d: number) => date.getMonth() === m && date.getDate() === d;
  switch (trophyId) {
    case "new-year-same-me":
      return md(0, 1);
    case "heartbreaker":
      return md(1, 14);
    case "liftin-lucky":
      return md(2, 17);
    case "weight-is-risen": {
      const e = easterDate(y);
      return date.getMonth() === e.getMonth() && date.getDate() === e.getDate();
    }
    case "american-made":
      return md(6, 4);
    case "scary-strong":
      return md(9, 31);
    case "turkey-bowl": {
      const t = thanksgivingDate(y);
      return date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
    }
    case "jingle-dumbells":
      return md(11, 25);
    case "repsolution":
      return md(11, 31);
    default:
      return false;
  }
}

// Strength tiers earn only through the video-verification stub — see
// lib/verifyLift.ts (`verifyLift({exercise,value,unit,mediaId,performedAt})`).
export { verifyLift, type VerifyLiftInput, type VerifyLiftResult } from "@/lib/verifyLift";
