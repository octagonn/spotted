import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { type LiftExercise } from "@/lib/liftCatalog";

/** Best-ever value per exercise for a user (drives strength trophies). */
export function useUserLifts(userId?: string | null) {
  return useQuery({
    queryKey: ["user-lifts", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("user_lifts")
        .select("exercise, value")
        .eq("user_id", userId as string);
      if (error) throw error;
      const best: Record<string, number> = {};
      for (const row of (data ?? []) as { exercise: string; value: number }[]) {
        best[row.exercise] = Math.max(best[row.exercise] ?? 0, row.value);
      }
      return best;
    }
  });
}

/** Record a logged lift (the honor-system entry attached to a post). */
export function useLogLift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      exercise: LiftExercise;
      value: number;
      unit: "lb" | "reps";
      postId?: string | null;
    }) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from("user_lifts").insert({
        user_id: input.userId,
        exercise: input.exercise,
        value: input.value,
        unit: input.unit,
        post_id: input.postId ?? null
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["user-lifts", vars.userId] });
    }
  });
}
