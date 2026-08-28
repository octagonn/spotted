import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { SessionPR, WorkoutExercise } from "@/hooks/queries/useWorkouts";

export type { SessionPR };

type WorkoutSessionState = {
  /** A workout is in progress (survives leaving the screen — the tab shows an
   *  IN PROGRESS card with a live timer + Resume, per the prototype). */
  active: boolean;
  /** Epoch ms when the session started. */
  startedAt: number;
  /** Custom workout name (header pencil). Lives HERE, not in screen state —
   *  the session survives leaving the screen and app restarts, so the name
   *  must too (beta: "none of my lifting section names are saving"). */
  name: string;
  exercises: WorkoutExercise[];
  sessionPRs: SessionPR[];
  /** Best-known value per exercise name (lift = max lb, cardio = max mi).
   *  Seeded from history at session start, bumped as PRs land. */
  bests: Record<string, number>;
  /** Auto rest countdown after each logged set (user preference, persisted). */
  restTimerEnabled: boolean;
  toggleRestTimer: () => void;
  start: () => void;
  setName: (name: string) => void;
  /** Merge history-derived bests without downgrading in-session bumps. */
  seedBests: (bests: Record<string, number>) => void;
  setExercises: (updater: (prev: WorkoutExercise[]) => WorkoutExercise[]) => void;
  recordPR: (pr: SessionPR, exerciseName: string, newBest: number) => void;
  /** End the session (after save or discard). */
  clear: () => void;
};

export const useWorkoutSession = create<WorkoutSessionState>((set) => ({
  active: false,
  startedAt: 0,
  name: "",
  exercises: [],
  sessionPRs: [],
  bests: {},
  restTimerEnabled: true,
  toggleRestTimer: () => set((s) => ({ restTimerEnabled: !s.restTimerEnabled })),
  start: () => set({ active: true, startedAt: Date.now(), name: "", exercises: [], sessionPRs: [], bests: {} }),
  setName: (name) => set({ name }),
  seedBests: (incoming) =>
    set((s) => {
      const merged = { ...incoming };
      for (const [name, value] of Object.entries(s.bests)) {
        merged[name] = Math.max(merged[name] ?? 0, value);
      }
      return { bests: merged };
    }),
  setExercises: (updater) => set((s) => ({ exercises: updater(s.exercises) })),
  recordPR: (pr, exerciseName, newBest) =>
    set((s) => ({
      bests: { ...s.bests, [exerciseName]: newBest },
      sessionPRs: [...s.sessionPRs.filter((p) => p.name !== pr.name), pr]
    })),
  clear: () => set({ active: false, startedAt: 0, name: "", exercises: [], sessionPRs: [], bests: {} })
}));

/* -------- persistence (hand-rolled; zustand/middleware's ESM build breaks
   Metro web with import.meta, so we mirror persist() with AsyncStorage) ----- */

const STORAGE_KEY = "workout-session-v1";
let hydrating = true;

void AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<WorkoutSessionState>;
    // The rest-timer preference restores regardless of session state.
    if (typeof saved.restTimerEnabled === "boolean") {
      useWorkoutSession.setState({ restTimerEnabled: saved.restTimerEnabled });
    }
    // Don't clobber a session the user already started this launch.
    if (saved.active && !useWorkoutSession.getState().active) {
      useWorkoutSession.setState({
        active: true,
        startedAt: typeof saved.startedAt === "number" ? saved.startedAt : Date.now(),
        name: typeof saved.name === "string" ? saved.name : "",
        exercises: Array.isArray(saved.exercises) ? saved.exercises : [],
        sessionPRs: Array.isArray(saved.sessionPRs) ? saved.sessionPRs : [],
        bests: saved.bests && typeof saved.bests === "object" ? saved.bests : {}
      });
    }
  })
  .catch(() => undefined)
  .finally(() => {
    hydrating = false;
  });

useWorkoutSession.subscribe((s) => {
  if (hydrating) return;
  void AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      active: s.active,
      startedAt: s.startedAt,
      name: s.name,
      exercises: s.exercises,
      sessionPRs: s.sessionPRs,
      bests: s.bests,
      restTimerEnabled: s.restTimerEnabled
    })
  ).catch(() => undefined);
});
