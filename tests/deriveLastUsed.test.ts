import { describe, expect, it, vi } from "vitest";

import { deriveLastUsed } from "../hooks/queries/useWorkouts";
import type { WorkoutExercise, WorkoutRow } from "../hooks/queries/useWorkouts";

// useWorkouts transitively imports react-native (Flow syntax vite can't
// parse) through supabase/ui-store — stub those chains out; deriveLastUsed
// itself is pure.
vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: false, supabase: {} }));
vi.mock("../stores/ui", () => ({ showToast: () => {} }));

function workout(startedAt: string, exercises: WorkoutExercise[]): WorkoutRow {
  return {
    id: startedAt,
    userId: "u1",
    name: "W",
    startedAt,
    durationSeconds: 3600,
    totalVolume: 0,
    totalSets: 0,
    cardioMinutes: 0,
    exerciseCount: exercises.length,
    exercises,
    prs: [],
    postId: null
  };
}

describe("deriveLastUsed", () => {
  it("takes the final completed set from the most recent workout (newest-first input)", () => {
    const rows = [
      workout("2026-08-17", [
        {
          id: 1,
          name: "Bench Press",
          muscle: "Chest",
          kind: "lift",
          defW: 45,
          defR: 10,
          sets: [
            { id: 1, w: 185, r: 8, done: true },
            { id: 2, w: 195, r: 5, done: true },
            { id: 3, w: 205, r: 1, done: false }
          ]
        }
      ]),
      workout("2026-08-10", [
        {
          id: 2,
          name: "Bench Press",
          muscle: "Chest",
          kind: "lift",
          defW: 45,
          defR: 10,
          sets: [{ id: 1, w: 135, r: 10, done: true }]
        }
      ])
    ];
    expect(deriveLastUsed(rows)["Bench Press"]).toEqual({ kind: "lift", w: 195, r: 5 });
  });

  it("skips exercises with no completed sets and falls back to an older workout", () => {
    const rows = [
      workout("2026-08-17", [
        { id: 1, name: "Squat", muscle: "Legs", kind: "lift", defW: 45, defR: 10, sets: [{ id: 1, w: 225, r: 5, done: false }] }
      ]),
      workout("2026-08-10", [
        { id: 2, name: "Squat", muscle: "Legs", kind: "lift", defW: 45, defR: 10, sets: [{ id: 1, w: 205, r: 5, done: true }] }
      ])
    ];
    expect(deriveLastUsed(rows)["Squat"]).toEqual({ kind: "lift", w: 205, r: 5 });
  });

  it("captures cardio minutes/miles and optional incline", () => {
    const rows = [
      workout("2026-08-17", [
        {
          id: 1,
          name: "Treadmill",
          muscle: "Cardio",
          kind: "cardio",
          defMin: 20,
          defMi: 0,
          hasInc: true,
          defInc: 1,
          sets: [{ id: 1, min: 25, mi: 2.5, inc: 3, done: true }]
        }
      ])
    ];
    expect(deriveLastUsed(rows)["Treadmill"]).toEqual({ kind: "cardio", min: 25, mi: 2.5, inc: 3 });
  });

  it("returns empty for no history", () => {
    expect(deriveLastUsed(undefined)).toEqual({});
    expect(deriveLastUsed([])).toEqual({});
  });
});
