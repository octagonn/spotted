/**
 * The workout-entry taxonomy — derived FROM the trophy catalog so the two can
 * never drift apart. Every strength trophy line is a selectable exercise with
 * the field (weight or reps) that drives its trophy thresholds.
 */

import { TROPHIES_BY_ID, type TrophyDefinition } from "@/lib/trophies";

export type LiftExercise = "bench" | "squat" | "deadlift" | "pullups" | "pushups";

export type LiftEntryOption = {
  id: LiftExercise;
  /** Display name (from the trophy catalog). */
  name: string;
  /** Whether the trophy keys off weight (lb) or reps. */
  unit: "lb" | "reps";
  /** The trophy definition this exercise maps to. */
  def: TrophyDefinition;
  /** Best-ever stat key the engine reads (benchMax, pullupMax, …). */
  statKey: string;
};

const UNIT: Record<LiftExercise, "lb" | "reps"> = {
  bench: "lb",
  squat: "lb",
  deadlift: "lb",
  pullups: "reps",
  pushups: "reps"
};

function statKeyFor(id: LiftExercise): string {
  if (id === "pullups") return "pullupMax";
  if (id === "pushups") return "pushupMax";
  return `${id}Max`;
}

/** All strength trophy lines, in catalog order — the entry options. */
export const LIFT_OPTIONS: LiftEntryOption[] = (["bench", "squat", "deadlift", "pullups", "pushups"] as LiftExercise[])
  .filter((id) => TROPHIES_BY_ID[id])
  .map((id) => ({
    id,
    name: TROPHIES_BY_ID[id].name,
    unit: UNIT[id],
    def: TROPHIES_BY_ID[id],
    statKey: statKeyFor(id)
  }));

export const LIFT_OPTION_BY_ID: Record<string, LiftEntryOption> = Object.fromEntries(
  LIFT_OPTIONS.map((o) => [o.id, o])
);

/**
 * Tiers newly crossed by going from `oldBest` to `newValue` for an exercise —
 * i.e. everything unlocked by this post (cascade: all lower tiers included).
 * Highest first.
 */
export function newlyUnlockedTiers(exercise: LiftExercise, oldBest: number, newValue: number) {
  const def = LIFT_OPTION_BY_ID[exercise]?.def;
  if (!def?.tiers) return [];
  return def.tiers
    .filter((t) => t.value > oldBest && t.value <= newValue)
    .sort((a, b) => b.value - a.value);
}
