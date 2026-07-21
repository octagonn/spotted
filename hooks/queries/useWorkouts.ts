import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CANONICAL_IS_REPS, CANONICAL_LIFT, type Muscle } from "@/lib/workoutLibrary";
import { LIFT_OPTION_BY_ID, newlyUnlockedTiers, type LiftExercise } from "@/lib/liftCatalog";
import type { TrophyShareData } from "@/components/trophies/TrophyShareCard";
import type { Json } from "@/types/database";

/** A single logged set (lift) or interval (cardio). */
export type LiftSet = { id: number; w: number; r: number; done: boolean };
export type CardioSet = { id: number; min: number; mi: number; inc?: number; done: boolean };

export type WorkoutExercise =
  | { id: number; name: string; muscle: Muscle; kind: "lift"; defW: number; defR: number; sets: LiftSet[] }
  | {
      id: number;
      name: string;
      muscle: Muscle;
      kind: "cardio";
      defMin: number;
      defMi: number;
      hasInc: boolean;
      defInc?: number;
      sets: CardioSet[];
    };

/** A persisted workout row (history). */
export type WorkoutRow = {
  id: string;
  userId: string;
  name: string;
  startedAt: string;
  durationSeconds: number;
  totalVolume: number;
  totalSets: number;
  cardioMinutes: number;
  exerciseCount: number;
  exercises: WorkoutExercise[];
  postId: string | null;
};

/** Recent workouts for a user (self or a friend, per RLS). Newest first. */
export function useWorkouts(userId?: string | null) {
  return useQuery({
    queryKey: ["workouts", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<WorkoutRow[]> => {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, user_id, name, started_at, duration_seconds, total_volume, total_sets, cardio_minutes, exercise_count, data, post_id"
        )
        .eq("user_id", userId as string)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        startedAt: row.started_at,
        durationSeconds: row.duration_seconds,
        totalVolume: row.total_volume,
        totalSets: row.total_sets,
        cardioMinutes: row.cardio_minutes,
        exerciseCount: row.exercise_count,
        exercises: Array.isArray(row.data) ? (row.data as unknown as WorkoutExercise[]) : [],
        postId: row.post_id
      }));
    }
  });
}

/** A single workout by id (self or friend, per RLS) for the detail view. */
export function useWorkout(workoutId?: string | null) {
  return useQuery({
    queryKey: ["workout", workoutId],
    enabled: isSupabaseConfigured && Boolean(workoutId),
    staleTime: 60_000,
    queryFn: async (): Promise<WorkoutRow | null> => {
      const { data, error } = await supabase
        .from("workouts")
        .select(
          "id, user_id, name, started_at, duration_seconds, total_volume, total_sets, cardio_minutes, exercise_count, data, post_id"
        )
        .eq("id", workoutId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        startedAt: data.started_at,
        durationSeconds: data.duration_seconds,
        totalVolume: data.total_volume,
        totalSets: data.total_sets,
        cardioMinutes: data.cardio_minutes,
        exerciseCount: data.exercise_count,
        exercises: Array.isArray(data.data) ? (data.data as unknown as WorkoutExercise[]) : [],
        postId: data.post_id
      };
    }
  });
}

export type SaveWorkoutInput = {
  userId: string;
  name: string;
  /** Epoch ms when the session started. */
  startedAt: number;
  durationSeconds: number;
  exercises: WorkoutExercise[];
};

export type SaveWorkoutResult = {
  workoutId: string | null;
  /** Trophy tiers newly crossed by PRs in this workout (highest per lift). */
  celebrations: TrophyShareData[];
};

/**
 * Persist a finished workout, then log any canonical-lift PRs into user_lifts
 * (firing the trophy cascade). Returns the newly-earned top tiers so the finish
 * screen can celebrate them.
 */
export function useSaveWorkout() {
  const queryClient = useQueryClient();
  return useMutation<SaveWorkoutResult, Error, SaveWorkoutInput>({
    mutationFn: async (input) => {
      if (!isSupabaseConfigured) return { workoutId: null, celebrations: [] };

      // Summaries from done sets only.
      let totalVolume = 0;
      let totalSets = 0;
      let cardioMinutes = 0;
      let exerciseCount = 0;
      // Best value per canonical lift in THIS session (weight or reps).
      const sessionBest: Partial<Record<LiftExercise, number>> = {};

      for (const ex of input.exercises) {
        const anyDone = ex.sets.some((s) => s.done);
        if (anyDone) exerciseCount += 1;
        const canonical = CANONICAL_LIFT[ex.name];
        for (const s of ex.sets) {
          if (!s.done) continue;
          totalSets += 1;
          if (ex.kind === "cardio") {
            cardioMinutes += (s as CardioSet).min;
          } else {
            const set = s as LiftSet;
            totalVolume += set.w * set.r;
            if (canonical) {
              const value = CANONICAL_IS_REPS[canonical] ? set.r : set.w;
              sessionBest[canonical] = Math.max(sessionBest[canonical] ?? 0, value);
            }
          }
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from("workouts")
        .insert({
          user_id: input.userId,
          name: input.name.trim() || "Workout",
          started_at: new Date(input.startedAt).toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: input.durationSeconds,
          total_volume: totalVolume,
          total_sets: totalSets,
          cardio_minutes: cardioMinutes,
          exercise_count: exerciseCount,
          data: input.exercises as unknown as Json
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Read existing bests so we only log genuine PRs and compute the cascade.
      const { data: liftRows } = await supabase
        .from("user_lifts")
        .select("exercise, value")
        .eq("user_id", input.userId);
      const priorBest: Record<string, number> = {};
      for (const row of (liftRows ?? []) as { exercise: string; value: number }[]) {
        priorBest[row.exercise] = Math.max(priorBest[row.exercise] ?? 0, row.value);
      }

      const celebrations: TrophyShareData[] = [];
      for (const [exercise, value] of Object.entries(sessionBest) as [LiftExercise, number][]) {
        const old = priorBest[exercise] ?? 0;
        if (value <= old) continue; // not a PR
        const option = LIFT_OPTION_BY_ID[exercise];
        await supabase.from("user_lifts").insert({
          user_id: input.userId,
          exercise,
          value,
          unit: option?.unit ?? "lb",
          post_id: null
        });
        const crossed = newlyUnlockedTiers(exercise, old, value);
        if (crossed.length > 0 && option) {
          const top = crossed[0];
          celebrations.push({
            icon: option.def.icon,
            name: top.name,
            familyName: option.name,
            earnedAt: new Date().toISOString(),
            rarityPct: top.rarityPct
          });
        }
      }

      return { workoutId: inserted.id, celebrations };
    },
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["workouts", vars.userId] });
      void queryClient.invalidateQueries({ queryKey: ["user-lifts", vars.userId] });
    }
  });
}
