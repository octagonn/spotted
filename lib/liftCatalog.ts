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
  /** The trophy definition this exercise maps to (undefined until the catalog loads). */
  def?: TrophyDefinition;
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

const LIFT_IDS: LiftExercise[] = ["bench", "squat", "deadlift", "pullups", "pushups"];

/** Display names used until the server trophy catalog has loaded. */
const FALLBACK_NAMES: Record<LiftExercise, string> = {
  bench: "Bench Press",
  squat: "Squat",
  deadlift: "Deadlift",
  pullups: "Pull-ups",
  pushups: "Push-ups"
};

/**
 * All strength trophy lines, in catalog order — the entry options.
 *
 * Resolved LAZILY: `TROPHIES_BY_ID` is filled by `useTrophyCatalog` at runtime,
 * so a module-level snapshot would be empty on a cold start (the camera's lift
 * picker crashed with "Cannot read property 'unit' of undefined"). Before the
 * catalog arrives the options still exist with fallback names and no `def`.
 */
export function getLiftOptions(): LiftEntryOption[] {
  return LIFT_IDS.map((id) => {
    const def = TROPHIES_BY_ID[id];
    return { id, name: def?.name ?? FALLBACK_NAMES[id], unit: UNIT[id], def, statKey: statKeyFor(id) };
  });
}

/** One option by id; `undefined` for ids that aren't a lift exercise (e.g. a stale draft). */
export function getLiftOption(id: string): LiftEntryOption | undefined {
  return (LIFT_IDS as string[]).includes(id) ? getLiftOptions().find((o) => o.id === id) : undefined;
}

export function isLiftExercise(id: string): id is LiftExercise {
  return (LIFT_IDS as string[]).includes(id);
}

/**
 * Tiers newly crossed by going from `oldBest` to `newValue` for an exercise —
 * i.e. everything unlocked by this post (cascade: all lower tiers included).
 * Highest first.
 */
export function newlyUnlockedTiers(exercise: LiftExercise, oldBest: number, newValue: number) {
  const def = getLiftOption(exercise)?.def;
  if (!def?.tiers) return [];
  return def.tiers.filter((t) => t.value > oldBest && t.value <= newValue).sort((a, b) => b.value - a.value);
}
