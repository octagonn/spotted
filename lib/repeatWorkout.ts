import type { WorkoutExercise } from "@/hooks/queries/useWorkouts";

/**
 * Turn a finished workout into a fresh session you can run again.
 *
 * Keeps the shape of the day — same exercises, same order, same number of sets,
 * and the weights/reps you hit last time as the targets to beat. Clears
 * everything that belonged to that specific session: no set is pre-checked, and
 * last time's PR flags don't carry over (they'd re-fire the celebration for
 * lifts you haven't done yet).
 *
 * Sets that were never completed are dropped: an abandoned 5th set shouldn't
 * become part of the routine. An exercise left with nothing keeps one empty set
 * so the card is still usable rather than disappearing.
 */
export function repeatableExercises(exercises: readonly WorkoutExercise[]): WorkoutExercise[] {
  return exercises.map((exercise) => {
    if (exercise.kind === "cardio") {
      const done = exercise.sets.filter((set) => set.done);
      const source = done.length ? done : exercise.sets.slice(0, 1);
      return {
        ...exercise,
        sets: source.map((set, index) => ({
          id: index + 1,
          min: set.min,
          mi: set.mi,
          ...(set.inc === undefined ? {} : { inc: set.inc }),
          done: false
        }))
      };
    }
    const done = exercise.sets.filter((set) => set.done);
    const source = done.length ? done : exercise.sets.slice(0, 1);
    return {
      ...exercise,
      sets: source.map((set, index) => ({ id: index + 1, w: set.w, r: set.r, done: false }))
    };
  });
}

/**
 * Name for the repeated session. "Push Day" run again is still "Push Day" —
 * but an auto-named row ("Workout", "Evening Workout") carries no intent worth
 * keeping, so those start fresh and get named by the usual rules.
 */
const AUTO_NAMES = /^(morning |afternoon |evening |night |late night )?workout$/i;

export function repeatWorkoutName(name: string): string {
  const trimmed = name.trim();
  return !trimmed || AUTO_NAMES.test(trimmed) ? "" : trimmed;
}
