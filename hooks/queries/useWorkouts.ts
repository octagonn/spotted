import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CANONICAL_IS_REPS, CANONICAL_LIFT, type Muscle } from "@/lib/workoutLibrary";
import { LIFT_OPTION_BY_ID, type LiftExercise } from "@/lib/liftCatalog";
import type { TrophyShareData } from "@/components/trophies/TrophyShareCard";
import type { Json } from "@/types/database";

/** A single logged set (lift) or interval (cardio). `pr` marks a set that beat
 *  the user's best at the moment it was logged (gold-highlighted everywhere). */
export type LiftSet = { id: number; w: number; r: number; done: boolean; pr?: boolean };
export type CardioSet = { id: number; min: number; mi: number; inc?: number; done: boolean; pr?: boolean };

/** A personal record earned during a session (summary/detail trophy rows). */
export type SessionPR = {
  /** Exercise name, e.g. "Bench Press". */
  name: string;
  /** Display value, e.g. "185 lb" or "3.4 mi". */
  value: string;
  /** Display context, e.g. "was 170 lb" or "first log". */
  was: string;
};

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
  /** PRs earned in this session (empty for legacy rows). */
  prs: SessionPR[];
  postId: string | null;
};

/** `data` is either the legacy bare exercises array or the current envelope. */
function parseWorkoutData(data: unknown): { exercises: WorkoutExercise[]; prs: SessionPR[] } {
  if (Array.isArray(data)) return { exercises: data as unknown as WorkoutExercise[], prs: [] };
  if (data && typeof data === "object") {
    const obj = data as { exercises?: unknown; prs?: unknown };
    return {
      exercises: Array.isArray(obj.exercises) ? (obj.exercises as unknown as WorkoutExercise[]) : [],
      prs: Array.isArray(obj.prs) ? (obj.prs as unknown as SessionPR[]) : []
    };
  }
  return { exercises: [], prs: [] };
}

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
      return (data ?? []).map((row) => {
        const parsed = parseWorkoutData(row.data);
        return {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          startedAt: row.started_at,
          durationSeconds: row.duration_seconds,
          totalVolume: row.total_volume,
          totalSets: row.total_sets,
          cardioMinutes: row.cardio_minutes,
          exerciseCount: row.exercise_count,
          exercises: parsed.exercises,
          prs: parsed.prs,
          postId: row.post_id
        };
      });
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
      const parsed = parseWorkoutData(data.data);
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
        exercises: parsed.exercises,
        prs: parsed.prs,
        postId: data.post_id
      };
    }
  });
}

/** Whether PRs for this exercise are graded on reps (bodyweight canonicals). */
export function isRepsGraded(name: string): boolean {
  const canonical = CANONICAL_LIFT[name];
  return canonical ? CANONICAL_IS_REPS[canonical] : false;
}

/**
 * Best-known value per exercise name, derived from workout history plus the
 * canonical user_lifts bests. Lifts grade on weight (reps for bodyweight
 * canonicals); cardio grades on distance. Seeds the in-session PR detector.
 */
export function deriveExerciseBests(
  workouts: WorkoutRow[] | undefined,
  canonicalBests: Record<string, number> | undefined
): Record<string, number> {
  const bests: Record<string, number> = {};
  const bump = (name: string, value: number) => {
    if (value > 0) bests[name] = Math.max(bests[name] ?? 0, value);
  };
  for (const workout of workouts ?? []) {
    for (const ex of workout.exercises) {
      for (const s of ex.sets) {
        if (!s.done) continue;
        if (ex.kind === "cardio") bump(ex.name, (s as CardioSet).mi);
        else bump(ex.name, isRepsGraded(ex.name) ? (s as LiftSet).r : (s as LiftSet).w);
      }
    }
  }
  if (canonicalBests) {
    for (const [name, canonical] of Object.entries(CANONICAL_LIFT)) {
      const value = canonicalBests[canonical];
      if (typeof value === "number") bump(name, value);
    }
  }
  return bests;
}

/** Today's daily post id for a user, or null (drives the "add to daily" CTA). */
export function useTodayDailyPost(userId?: string | null) {
  return useQuery({
    queryKey: ["today-daily-post", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<string | null> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", userId as string)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    }
  });
}

/**
 * Attach a finished workout to today's daily post so it appears as a feed
 * slide. If it's a SECOND workout (the post already has one attached), notify
 * the user's friends.
 */
export function useAttachWorkoutToDaily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ workoutId, postId, workoutName }: { workoutId: string; postId: string; workoutName: string }) => {
      // Is this the first workout on the post? (If not, it's a 2nd+ → notify.)
      const { count } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId);
      const { error } = await supabase.from("workouts").update({ post_id: postId }).eq("id", workoutId);
      if (error) throw error;
      if ((count ?? 0) > 0) {
        try {
          await supabase.rpc("notify_second_workout", { p_post: postId, p_name: workoutName });
        } catch {
          // Notifying friends is best-effort — the attach already succeeded.
        }
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["feed"] })
  });
}

export type SaveWorkoutInput = {
  userId: string;
  name: string;
  /** Epoch ms when the session started. */
  startedAt: number;
  durationSeconds: number;
  exercises: WorkoutExercise[];
  /** In-session PRs (persisted for the summary/detail trophy rows). */
  sessionPRs?: SessionPR[];
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
          data: { exercises: input.exercises, prs: input.sessionPRs ?? [] } as unknown as Json
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

      // Log each genuine PR into user_lifts (the derived source of truth). The
      // server cap guard rejects out-of-range values; skip those rather than
      // failing the whole save.
      for (const [exercise, value] of Object.entries(sessionBest) as [LiftExercise, number][]) {
        const old = priorBest[exercise] ?? 0;
        if (value <= old) continue; // not a PR
        const option = LIFT_OPTION_BY_ID[exercise];
        await supabase
          .from("user_lifts")
          .insert({ user_id: input.userId, exercise, value, unit: option?.unit ?? "lb", post_id: null });
      }

      // Trophy unlocks come from the ONE engine (spec B) — idempotent, permanent,
      // rule-driven. It returns only freshly-unlocked tiers for the animation
      // queue. Highest tier per family first.
      const celebrations: TrophyShareData[] = [];
      const { data: unlocked } = await supabase.rpc("evaluate_trophies", { p_user: input.userId });
      const rows = ((unlocked ?? []) as { out_family_id: string; out_name: string; out_tier: number }[]).sort(
        (a, b) => b.out_tier - a.out_tier
      );
      const seenFamily = new Set<string>();
      for (const row of rows) {
        if (seenFamily.has(row.out_family_id)) continue; // one animation per family
        seenFamily.add(row.out_family_id);
        const option = LIFT_OPTION_BY_ID[row.out_family_id];
        celebrations.push({
          icon: option?.def.icon ?? "trophy",
          name: row.out_name,
          familyName: option?.name ?? row.out_family_id,
          earnedAt: new Date().toISOString(),
          rarityPct: 50
        });
      }

      return { workoutId: inserted.id, celebrations };
    },
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["workouts", vars.userId] });
      void queryClient.invalidateQueries({ queryKey: ["user-lifts", vars.userId] });
    }
  });
}
