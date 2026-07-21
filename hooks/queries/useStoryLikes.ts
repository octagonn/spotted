import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** Whether the current user has liked a given story (private). */
export function useStoryLiked(storyId: string | null) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["story-liked", storyId, userId],
    enabled: isSupabaseConfigured && Boolean(storyId) && Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("story_likes")
        .select("story_id")
        .eq("story_id", storyId as string)
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }
  });
}

/**
 * The set of user ids who liked a story — only the story owner can read this
 * (RLS). Used to show a heart next to likers in the viewer list.
 */
export function useStoryLikers(storyId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["story-likers", storyId],
    enabled: isSupabaseConfigured && Boolean(storyId) && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("story_likes")
        .select("user_id")
        .eq("story_id", storyId as string);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id));
    }
  });
}

/** Like / unlike a story — optimistic, private (no public counts). */
export function useToggleStoryLike() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ storyId, like }: { storyId: string; like: boolean }) => {
      if (!isSupabaseConfigured || !userId) return;
      if (like) {
        const { error } = await supabase.from("story_likes").upsert(
          { story_id: storyId, user_id: userId },
          { ignoreDuplicates: true }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("story_likes")
          .delete()
          .eq("story_id", storyId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onMutate: async ({ storyId, like }) => {
      const key = ["story-liked", storyId, userId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, like);
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, { storyId }) => {
      void queryClient.invalidateQueries({ queryKey: ["story-liked", storyId, userId] });
      void queryClient.invalidateQueries({ queryKey: ["story-likers", storyId] });
    }
  });
}
