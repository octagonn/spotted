import { useMemo } from "react";

import { gymDayKeys, restDayKeys, type StreakDayMap } from "@/hooks/queries/useStreakDays";
import { computeGymStreak } from "@/lib/streak";

/**
 * Streak from the gym-day ledger with rest-day bridging — the one true
 * client-side streak computation, shared by the own-profile and other-user
 * profile screens so they can never disagree.
 *
 * Takes `useStreakDays(...).data` directly. Guards the Map contract: a
 * stale/corrupted persisted react-query cache could hand back a non-Map, so
 * only treat it as a ledger when it really is one.
 */
export function useGymStreak(streakDaysData: StreakDayMap | undefined) {
  return useMemo(() => {
    const map = streakDaysData instanceof Map ? streakDaysData : undefined;
    // Rest days bridge the streak but never inflate it.
    return computeGymStreak(gymDayKeys(map), undefined, restDayKeys(map));
  }, [streakDaysData]);
}
