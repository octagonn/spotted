/** Local-date key "YYYY-MM-DD" (mirrors stores/ui localDateKey, kept dependency-free). */
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type GymStreak = {
  /** Consecutive gym days, counting today's grace window. */
  count: number;
  /**
   * True when the user posted yesterday but not yet today — the streak is still
   * alive through the end of today. Drives the "keep it alive" nudge.
   */
  keepAlive: boolean;
};

/**
 * Consecutive-gym-day streak with a grace window for today, and rest days that
 * FREEZE the streak rather than extend it.
 *
 * A streak shouldn't drop to 0 the morning after a post — you still have all of
 * today to keep it going. So we anchor on today if there's a post today,
 * otherwise on yesterday, and walk backwards counting consecutive gym days.
 * Posting yesterday but not today yields a streak of 1 (keepAlive), not 0.
 *
 * A rest day BRIDGES the run — the streak survives it — but is NOT counted in
 * the number, so the streak keeps meaning "days you actually trained": a 5-day
 * streak plus a rest day is still 5, and becomes 6 on the next gym day. A run
 * made only of rest days is therefore not a streak at all and reports 0.
 *
 * This must stay in lockstep with the server ledger (`gym_days.kind`, written
 * by `mark_rest_day`), which is the other half of the feature — if the two
 * disagree, the profile and the server report different streaks.
 */
export function computeGymStreak(
  dayKeys: Iterable<string>,
  now: Date = new Date(),
  restDayKeys?: Iterable<string>
): GymStreak {
  const set = dayKeys instanceof Set ? (dayKeys as Set<string>) : new Set(dayKeys);
  const rest = restDayKeys
    ? restDayKeys instanceof Set
      ? (restDayKeys as Set<string>)
      : new Set(restDayKeys)
    : null;
  /** A day the streak can stand on: trained, or a declared rest day. */
  const covered = (key: string) => set.has(key) || Boolean(rest?.has(key));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayHas = covered(dateKey(today));
  const yesterdayHas = covered(dateKey(yesterday));

  // Nothing today or yesterday → the streak has lapsed.
  if (!todayHas && !yesterdayHas) {
    return { count: 0, keepAlive: false };
  }

  const cursor = new Date(todayHas ? today : yesterday);
  let count = 0;
  while (covered(dateKey(cursor))) {
    // Rest days bridge the run without adding to the total.
    if (set.has(dateKey(cursor))) count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // A run of nothing but rest days is not a streak.
  if (count === 0) {
    return { count: 0, keepAlive: false };
  }

  return { count, keepAlive: !todayHas && yesterdayHas };
}
