import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** The user's pinned exercise names (Select Exercises floats these on top). */
export function useExerciseFavorites() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["exercise-favorites", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("exercise_favorites")
        .select("exercise_name")
        .eq("user_id", userId as string);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.exercise_name));
    }
  });
}

/** Pin/unpin an exercise — optimistic, so the star flips instantly. */
export function useToggleExerciseFavorite() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ name, favorite }: { name: string; favorite: boolean }) => {
      if (!isSupabaseConfigured || !userId) return;
      if (favorite) {
        const { error } = await supabase
          .from("exercise_favorites")
          .upsert({ user_id: userId, exercise_name: name }, { ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("exercise_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("exercise_name", name);
        if (error) throw error;
      }
    },
    onMutate: async ({ name, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ["exercise-favorites", userId] });
      const prev = queryClient.getQueryData<Set<string>>(["exercise-favorites", userId]);
      queryClient.setQueryData<Set<string>>(["exercise-favorites", userId], (old) => {
        const next = new Set(old ?? []);
        if (favorite) next.add(name);
        else next.delete(name);
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["exercise-favorites", userId], ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["exercise-favorites", userId] })
  });
}
