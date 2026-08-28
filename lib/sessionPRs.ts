import type { CardioSet, LiftSet, SessionPR, WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { CANONICAL_IS_REPS, CANONICAL_LIFT } from "@/lib/workoutLibrary";

/** Bodyweight canonicals (pull-ups, push-ups) are graded on reps, not weight. */
function repsGraded(name: string): boolean {
  const canonical = CANONICAL_LIFT[name];
  return canonical ? CANONICAL_IS_REPS[canonical] : false;
}

/** How an exercise is graded: weight, reps (bodyweight lifts), or distance. */
function unitFor(exercise: WorkoutExercise): "lb" | "reps" | "mi" {
  if (exercise.kind === "cardio") return "mi";
  return repsGraded(exercise.name) ? "reps" : "lb";
}

/** The graded value of one set, in its exercise's unit. */
function setValue(exercise: WorkoutExercise, set: LiftSet | CardioSet): number {
  if (exercise.kind === "cardio") return (set as CardioSet).mi;
  return repsGraded(exercise.name) ? (set as LiftSet).r : (set as LiftSet).w;
}

/** Best COMPLETED value for an exercise, in its graded unit. 0 if nothing done. */
export function bestDoneValue(exercise: WorkoutExercise): number {
  let best = 0;
  for (const set of exercise.sets) {
    if (!set.done) continue;
    const value = setValue(exercise, set);
    if (value > best) best = value;
  }
  return best;
}

/**
 * The PRs a workout actually earned, derived from the sets as they stand.
 *
 * The live detector fires the moment a set is checked and appends to a running
 * list, but nothing ever unwound that entry: fat-finger 490 instead of 190,
 * correct it, and the workout still saved a 490 lb PR forever (real report — a
 * 490 lb "max" from a session whose heaviest set was 190). Unchecking the set
 * left it behind too, and editing the workout later explicitly carried the old
 * `prs` array over untouched.
 *
 * Deriving from current state at save time makes corrections self-healing and
 * removes the whole class of bug, rather than trying to reverse each edit path.
 * The in-session celebration stays event-driven — it's a moment, not a record.
 *
 * `priorBests` must EXCLUDE this workout, or nothing ever reads as a PR.
 */
export function derivePRs(
  exercises: readonly WorkoutExercise[],
  priorBests: Record<string, number>
): SessionPR[] {
  const out: SessionPR[] = [];
  for (const exercise of exercises) {
    const best = bestDoneValue(exercise);
    if (best <= 0) continue;
    const prior = priorBests[exercise.name] ?? 0;
    if (best <= prior) continue;
    const unit = unitFor(exercise);
    out.push({
      name: exercise.name,
      value: `${best} ${unit}`,
      was: prior > 0 ? `was ${prior} ${unit}` : "first log"
    });
  }
  return out;
}

/**
 * Re-stamp per-set `pr` badges to match the derived PRs, so a corrected set
 * can't keep a badge it no longer earns. Only the first set that reaches the
 * record keeps it — later sets matching the same number aren't new records.
 */
export function applyPRFlags(
  exercises: readonly WorkoutExercise[],
  priorBests: Record<string, number>
): WorkoutExercise[] {
  return exercises.map((exercise) => {
    const best = bestDoneValue(exercise);
    const earned = best > 0 && best > (priorBests[exercise.name] ?? 0);
    let stamped = false;
    const sets = exercise.sets.map((set) => {
      const isPR = earned && !stamped && set.done && setValue(exercise, set) === best;
      if (isPR) stamped = true;
      const rest = { ...set };
      delete (rest as { pr?: boolean }).pr;
      return isPR ? { ...rest, pr: true } : rest;
    });
    return { ...exercise, sets } as WorkoutExercise;
  });
}
