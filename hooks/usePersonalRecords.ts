import { useMemo } from "react";

import { useWorkouts } from "@/hooks/queries/useWorkouts";

export type PersonalRecord = {
  /** Exercise name, e.g. "Bench Press" or "Outdoor Run". */
  name: string;
  /** Display value at the time of the PR, e.g. "215 lb" / "3.1 mi". */
  value: string;
  /** Context line, e.g. "was 185 lb" or "first log". */
  was: string;
  /** ISO date of the workout that set it. */
  earnedAt: string;
};

/**
 * Every workout-session PR, newest-best per exercise — the "TROPHIES EARNED"
 * rows from finished workouts, surfaced permanently in the trophy case.
 */
export function usePersonalRecords(userId?: string | null) {
  const workouts = useWorkouts(userId);
  const records = useMemo<PersonalRecord[]>(() => {
    const seen = new Set<string>();
    const out: PersonalRecord[] = [];
    // Workouts come newest-first, so the first PR per exercise is the current one.
    for (const workout of workouts.data ?? []) {
      for (const pr of workout.prs) {
        if (seen.has(pr.name)) continue;
        seen.add(pr.name);
        out.push({ name: pr.name, value: pr.value, was: pr.was, earnedAt: workout.startedAt });
      }
    }
    return out;
  }, [workouts.data]);
  return { records, isLoading: workouts.isLoading };
}
