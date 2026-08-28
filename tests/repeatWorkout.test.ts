import { describe, expect, it } from "vitest";

import type { WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { repeatWorkoutName, repeatableExercises } from "@/lib/repeatWorkout";

const bench = (): WorkoutExercise => ({
  id: 1,
  name: "Bench Press",
  muscle: "chest" as WorkoutExercise["muscle"],
  kind: "lift",
  defW: 135,
  defR: 8,
  sets: [
    { id: 1, w: 135, r: 10, done: true },
    { id: 2, w: 185, r: 8, done: true, pr: true },
    { id: 3, w: 205, r: 5, done: false }
  ]
});

const treadmill = (): WorkoutExercise => ({
  id: 2,
  name: "Treadmill",
  muscle: "cardio" as WorkoutExercise["muscle"],
  kind: "cardio",
  defMin: 20,
  defMi: 2,
  hasInc: true,
  sets: [
    { id: 1, min: 20, mi: 2.1, inc: 3, done: true },
    { id: 2, min: 10, mi: 1, done: false }
  ]
});

describe("repeatableExercises", () => {
  it("keeps last time's numbers as this time's targets", () => {
    const [ex] = repeatableExercises([bench()]);
    expect(ex.sets.map((s) => [(s as { w: number }).w, (s as { r: number }).r])).toEqual([
      [135, 10],
      [185, 8]
    ]);
  });

  it("checks nothing off", () => {
    for (const ex of repeatableExercises([bench(), treadmill()])) {
      expect(ex.sets.every((s) => s.done === false)).toBe(true);
    }
  });

  it("drops last time's PR flags so the celebration doesn't re-fire", () => {
    const [ex] = repeatableExercises([bench()]);
    expect(ex.sets.some((s) => (s as { pr?: boolean }).pr)).toBe(false);
  });

  it("drops sets that were never completed", () => {
    // The abandoned 205x5 isn't part of the routine.
    expect(repeatableExercises([bench()])[0].sets).toHaveLength(2);
    expect(repeatableExercises([treadmill()])[0].sets).toHaveLength(1);
  });

  it("keeps cardio incline when it was set", () => {
    const [ex] = repeatableExercises([treadmill()]);
    expect(ex.sets[0]).toMatchObject({ min: 20, mi: 2.1, inc: 3, done: false });
  });

  it("keeps a usable card for an exercise with nothing completed", () => {
    const untouched: WorkoutExercise = {
      ...(bench() as Extract<WorkoutExercise, { kind: "lift" }>),
      sets: [{ id: 1, w: 95, r: 12, done: false }]
    };
    const [ex] = repeatableExercises([untouched]);
    expect(ex.sets).toHaveLength(1);
    expect(ex.sets[0]).toMatchObject({ w: 95, r: 12, done: false });
  });

  it("renumbers sets from 1 after dropping", () => {
    const [ex] = repeatableExercises([bench()]);
    expect(ex.sets.map((s) => s.id)).toEqual([1, 2]);
  });

  it("leaves the original workout untouched", () => {
    const original = bench();
    repeatableExercises([original]);
    expect(original.sets[1].done).toBe(true);
    expect(original.sets).toHaveLength(3);
  });
});

describe("repeatWorkoutName", () => {
  it("carries a real routine name over", () => {
    expect(repeatWorkoutName("Push Day")).toBe("Push Day");
    expect(repeatWorkoutName("Leg Day 💀")).toBe("Leg Day 💀");
  });

  it("does not carry over an auto-generated name", () => {
    for (const auto of ["Workout", "Morning Workout", "Evening workout", "  workout  "]) {
      expect(repeatWorkoutName(auto)).toBe("");
    }
  });

  it("keeps a name that merely contains the word workout", () => {
    expect(repeatWorkoutName("Chest Workout")).toBe("Chest Workout");
  });
});
