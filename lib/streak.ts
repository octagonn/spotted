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
 * Consecutive-gym-day streak with a grace window for today.
 *
 * A streak shouldn't drop to 0 the morning after a post — you still have all of
 * today to keep it going. So we anchor on today if there's a post today,
 * otherwise on yesterday, and walk backwards counting consecutive gym days.
 * Posting yesterday but not today yields a streak of 1 (keepAlive), not 0.
 */
export function computeGymStreak(dayKeys: Iterable<string>, now: Date = new Date()): GymStreak {
  const set = dayKeys instanceof Set ? (dayKeys as Set<string>) : new Set(dayKeys);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayHas = set.has(dateKey(today));
  const yesterdayHas = set.has(dateKey(yesterday));

  // Nothing today or yesterday → the streak has lapsed.
  if (!todayHas && !yesterdayHas) {
    return { count: 0, keepAlive: false };
  }

  const cursor = new Date(todayHas ? today : yesterday);
  let count = 0;
  while (set.has(dateKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { count, keepAlive: !todayHas && yesterdayHas };
}
