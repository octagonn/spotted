import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/**
 * Cheap "does this user have an active story" check for the profile story ring —
 * a HEAD count instead of the full useStories() query (which fetches every
 * group and signs all media URLs), so the ring appears fast.
 */
export function useHasActiveStory(userId?: string | null) {
  return useQuery({
    queryKey: ["has-active-story", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId as string)
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return (count ?? 0) > 0;
    }
  });
}

export type Visibility = "public" | "friends" | "private";

/** Update the signed-in user's visibility (schedule_visibility). */
export function useSetVisibility() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (value: Visibility) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update({ schedule_visibility: value }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile"] })
  });
}
