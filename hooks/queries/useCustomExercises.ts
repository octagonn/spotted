import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { MUSCLES, type LibraryItem, type Muscle } from "@/lib/workoutLibrary";
import { useAuthStore } from "@/stores/auth";

type CustomExerciseRow = {
  name: string;
  muscle: string;
  def_w: number | null;
  def_r: number | null;
  def_min: number | null;
  def_mi: number | null;
  def_inc: number | null;
};

function rowToItem(row: CustomExerciseRow): LibraryItem {
  const muscle = (MUSCLES as readonly string[]).includes(row.muscle) ? (row.muscle as Muscle) : "Full Body";
  return {
    name: row.name,
    muscle,
    ...(row.def_w != null ? { w: row.def_w } : {}),
    ...(row.def_r != null ? { r: row.def_r } : {}),
    ...(row.def_min != null ? { min: row.def_min } : {}),
    ...(row.def_mi != null ? { mi: row.def_mi } : {}),
    ...(row.def_inc != null ? { inc: row.def_inc } : {}),
    custom: true
  };
}

/** The user's saved custom exercises, shaped as library items so Select
 *  Exercises can merge them straight into the pool. */
export function useCustomExercises() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["custom-exercises", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase
        .from("custom_exercises")
        .select("name, muscle, def_w, def_r, def_min, def_mi, def_inc")
        .eq("user_id", userId as string)
        .order("name");
      if (error) throw error;
      return (data ?? []).map(rowToItem);
    }
  });
}

/** Save a custom exercise so it exists in every future workout — optimistic,
 *  so it's in the list the moment the form closes. */
export function useSaveCustomExercise() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (item: LibraryItem) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase.from("custom_exercises").upsert({
        user_id: userId,
        name: item.name,
        muscle: item.muscle,
        def_w: item.w ?? null,
        def_r: item.r ?? null,
        def_min: item.min ?? null,
        def_mi: item.mi ?? null,
        def_inc: item.inc ?? null
      });
      if (error) throw error;
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ["custom-exercises", userId] });
      const prev = queryClient.getQueryData<LibraryItem[]>(["custom-exercises", userId]);
      queryClient.setQueryData<LibraryItem[]>(["custom-exercises", userId], (old) => {
        const rest = (old ?? []).filter((e) => e.name !== item.name);
        return [...rest, { ...item, custom: true }].sort((a, b) => a.name.localeCompare(b.name));
      });
      return { prev };
    },
    onError: (_err, _item, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["custom-exercises", userId], ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["custom-exercises", userId] })
  });
}
