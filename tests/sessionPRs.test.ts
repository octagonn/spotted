import { describe, expect, it } from "vitest";

import type { WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { applyPRFlags, bestDoneValue, derivePRs } from "@/lib/sessionPRs";

const lift = (name: string, sets: { w: number; r: number; done: boolean; pr?: boolean }[]): WorkoutExercise => ({
  id: 1,
  name,
  muscle: "chest" as WorkoutExercise["muscle"],
  kind: "lift",
  defW: 100,
  defR: 8,
  sets: sets.map((s, i) => ({ id: i + 1, ...s }))
});

const cardio = (name: string, sets: { min: number; mi: number; done: boolean }[]): WorkoutExercise => ({
  id: 2,
  name,
  muscle: "cardio" as WorkoutExercise["muscle"],
  kind: "cardio",
  defMin: 20,
  defMi: 2,
  hasInc: false,
  sets: sets.map((s, i) => ({ id: i + 1, ...s }))
});

describe("derivePRs", () => {
  it("reports the real best from the sets as they stand", () => {
    // Ryan's actual workout: Machine Chest Press 180/180/190/190, prior 180.
    const prs = derivePRs([lift("Machine Chest Press", [
      { w: 180, r: 10, done: true },
      { w: 180, r: 10, done: true },
      { w: 190, r: 10, done: true },
      { w: 190, r: 10, done: true }
    ])], { "Machine Chest Press": 180 });
    expect(prs).toEqual([{ name: "Machine Chest Press", value: "190 lb", was: "was 180 lb" }]);
  });

  it("forgets a mistyped weight once it is corrected", () => {
    // 490 typed, then fixed to 190. The 490 must leave no trace.
    const corrected = lift("Machine Chest Press", [{ w: 190, r: 10, done: true, pr: true }]);
    const prs = derivePRs([corrected], { "Machine Chest Press": 180 });
    expect(prs[0].value).toBe("190 lb");
    expect(JSON.stringify(prs)).not.toContain("490");
  });

  it("drops the PR entirely when the corrected weight no longer beats the record", () => {
    const prs = derivePRs([lift("Bench Press", [{ w: 100, r: 10, done: true, pr: true }])], { "Bench Press": 225 });
    expect(prs).toEqual([]);
  });

  it("drops the PR when the set is unchecked", () => {
    expect(derivePRs([lift("Bench Press", [{ w: 405, r: 1, done: false }])], {})).toEqual([]);
  });

  it("ignores unchecked sets when finding the best", () => {
    const prs = derivePRs([lift("Bench Press", [
      { w: 135, r: 10, done: true },
      { w: 500, r: 1, done: false }
    ])], {});
    expect(prs[0].value).toBe("135 lb");
  });

  it("calls a first-ever log out as such", () => {
    expect(derivePRs([lift("JM Press", [{ w: 95, r: 8, done: true }])], {})[0].was).toBe("first log");
  });

  it("grades bodyweight lifts in reps", () => {
    const prs = derivePRs([lift("Pull-Up", [{ w: 0, r: 12, done: true }])], { "Pull-Up": 10 });
    expect(prs[0]).toEqual({ name: "Pull-Up", value: "12 reps", was: "was 10 reps" });
  });

  it("grades cardio on distance", () => {
    const prs = derivePRs([cardio("Treadmill", [{ min: 30, mi: 3.4, done: true }])], { Treadmill: 3 });
    expect(prs[0]).toEqual({ name: "Treadmill", value: "3.4 mi", was: "was 3 mi" });
  });

  it("does not report a tie as a record", () => {
    expect(derivePRs([lift("Bench Press", [{ w: 225, r: 5, done: true }])], { "Bench Press": 225 })).toEqual([]);
  });
});

describe("bestDoneValue", () => {
  it("is 0 when nothing was completed", () => {
    expect(bestDoneValue(lift("Bench Press", [{ w: 315, r: 3, done: false }]))).toBe(0);
  });
});

describe("applyPRFlags", () => {
  it("strips a badge the corrected set no longer earns", () => {
    const [ex] = applyPRFlags([lift("Bench Press", [{ w: 100, r: 10, done: true, pr: true }])], { "Bench Press": 225 });
    expect(ex.sets.some((s) => (s as { pr?: boolean }).pr)).toBe(false);
  });

  it("badges only the first set that reaches the record", () => {
    const [ex] = applyPRFlags([lift("Machine Chest Press", [
      { w: 180, r: 10, done: true },
      { w: 190, r: 10, done: true },
      { w: 190, r: 10, done: true }
    ])], { "Machine Chest Press": 180 });
    expect(ex.sets.map((s) => Boolean((s as { pr?: boolean }).pr))).toEqual([false, true, false]);
  });

  it("never badges an unchecked set", () => {
    const [ex] = applyPRFlags([lift("Bench Press", [{ w: 405, r: 1, done: false, pr: true }])], {});
    expect(ex.sets.every((s) => !(s as { pr?: boolean }).pr)).toBe(true);
  });
});
