import { useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { FeedPost } from "@/types/domain";

/** Reaction used for the heart button (schema constrains reaction to a fixed emoji set). */
export const LIKE_REACTION = "🔥";

const myReactionsKey = (userId: string | null) => ["my-reactions", userId] as const;

/** Post ids the signed-in user has reacted to. Backs the heart button's initial state. */
export function useMyReactions() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: myReactionsKey(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<string[]> => {
      if (!isSupabaseConfigured || !userId) {
        return [];
      }
      // Filter by the like emoji: selfie-only rows have reaction = null and
      // must not light up the heart.
      const { data, error } = await supabase
        .from("post_reactions")
        .select("post_id")
        .eq("user_id", userId)
        .eq("reaction", LIKE_REACTION);
      if (error) {
        throw error;
      }
      return (data ?? []).map((row) => row.post_id);
    }
  });
}

/** Toggle a like: insert/delete a post_reactions row with optimistic cache update. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!isSupabaseConfigured || !userId) {
        return;
      }
      if (liked) {
        const { error } = await supabase
          .from("post_reactions")
          .upsert({ post_id: postId, user_id: userId, reaction: LIKE_REACTION });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onMutate: async ({ postId, liked }) => {
      const queryKey = myReactionsKey(userId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, (current) => {
        const next = (current ?? []).filter((id) => id !== postId);
        return liked ? [...next, postId] : next;
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(myReactionsKey(userId), context.previous);
      }
    },
    onSettled: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey: myReactionsKey(userId) });
      }
    }
  });
}

/** Toggle posts.saved. RLS only allows the post owner to update — call for own posts only. */
export function useToggleSaved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, saved }: { postId: string; saved: boolean }) => {
      if (!isSupabaseConfigured) {
        return;
      }
      const { error } = await supabase.from("posts").update({ saved }).eq("id", postId);
      if (error) throw error;
    },
    onMutate: async ({ postId, saved }) => {
      // The feed is an INFINITE query keyed ["feed", userId] with shape
      // { pages: FeedPost[][] } — the old exact-key flat-array write matched
      // nothing (silent no-op). Prefix-match every feed cache and map its pages.
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const previous = queryClient.getQueriesData<InfiniteData<FeedPost[]>>({ queryKey: ["feed"] });
      queryClient.setQueriesData<InfiniteData<FeedPost[]>>({ queryKey: ["feed"] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) =>
                page.map((post) => (post.id === postId ? { ...post, saved } : post))
              )
            }
          : old
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
    }
  });
}

/** Record a replay in post_replays (fire-and-forget; server bumps replay_count). */
export function useReplayPost() {
  const userId = useAuthStore((state) => state.userId);

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!isSupabaseConfigured || !userId) {
        return;
      }
      const { error } = await supabase
        .from("post_replays")
        .insert({ post_id: postId, viewer_id: userId });
      if (error) throw error;
    }
  });
}
