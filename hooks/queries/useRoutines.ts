import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";

/** A named workout template — a plan you keep, not a session you logged. */
export type Routine = {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  lastUsedAt: string | null;
  createdAt: string;
};

/** Server cap (workout_routines_cap trigger) — mirrored for the client message. */
export const MAX_ROUTINES = 50;

const routinesKey = (userId: string | null | undefined) => ["workout-routines", userId] as const;

type RoutineRow = {
  id: string;
  name: string;
  exercises: unknown;
  last_used_at: string | null;
  created_at: string;
};

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    exercises: Array.isArray(row.exercises) ? (row.exercises as WorkoutExercise[]) : [],
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at
  };
}

/** Your saved routines, most recently used first. */
export function useRoutines() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: routinesKey(userId),
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<Routine[]> => {
      const { data, error } = await supabase
        .from("workout_routines")
        .select("id, name, exercises, last_used_at, created_at")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as RoutineRow[]).map(toRoutine);
    }
  });
}

/** A single routine, for hydrating the logger from /workout?routine=<id>. */
export function useRoutine(routineId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["workout-routine", routineId],
    enabled: isSupabaseConfigured && Boolean(routineId) && Boolean(userId),
    queryFn: async (): Promise<Routine | null> => {
      const { data, error } = await supabase
        .from("workout_routines")
        .select("id, name, exercises, last_used_at, created_at")
        .eq("id", routineId as string)
        .maybeSingle();
      if (error) throw error;
      return data ? toRoutine(data as RoutineRow) : null;
    }
  });
}

export function useSaveRoutine() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (input: { name: string; exercises: WorkoutExercise[] }) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase.from("workout_routines").insert({
        user_id: userId,
        name: input.name.trim().slice(0, 60) || "Routine",
        exercises: input.exercises as unknown as never
      });
      if (error) throw error;
      trackAnalyticsEvent("routine_saved", { exercises: input.exercises.length });
    },
    onSuccess: () => {
      showToast("Saved to your routines");
      void queryClient.invalidateQueries({ queryKey: routinesKey(userId) });
    },
    onError: (error: unknown) => {
      // The cap trigger raises a named exception rather than a constraint error.
      const message = error instanceof Error ? error.message : String(error);
      showToast(
        message.includes("routine_limit_reached")
          ? `You can keep ${MAX_ROUTINES} routines — delete one first`
          : "Couldn't save that routine"
      );
    }
  });
}

export function useRenameRoutine() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ routineId, name }: { routineId: string; name: string }) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase
        .from("workout_routines")
        .update({ name: name.trim().slice(0, 60) })
        .eq("id", routineId);
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: routinesKey(userId) }),
    onError: () => showToast("Couldn't rename that routine")
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (routineId: string) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from("workout_routines").delete().eq("id", routineId);
      if (error) throw error;
    },
    // Optimistic: the row leaves the list instantly, like workout history.
    onMutate: async (routineId) => {
      await queryClient.cancelQueries({ queryKey: routinesKey(userId) });
      const previous = queryClient.getQueryData<Routine[]>(routinesKey(userId));
      queryClient.setQueryData<Routine[]>(routinesKey(userId), (old) =>
        (old ?? []).filter((routine) => routine.id !== routineId)
      );
      return { previous };
    },
    onError: (_error, _routineId, context) => {
      if (context?.previous) queryClient.setQueryData(routinesKey(userId), context.previous);
      showToast("Couldn't delete that routine");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: routinesKey(userId) })
  });
}

/**
 * Stamp a routine as just-started so it sorts to the top next time.
 * Fire-and-forget — failing to record this must never block the workout.
 */
export function useMarkRoutineUsed() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (routineId: string) => {
      if (!isSupabaseConfigured) return;
      await supabase
        .from("workout_routines")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", routineId);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: routinesKey(userId) })
  });
}
