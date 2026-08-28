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

/** One row of the "who liked this post" list. */
export type PostLiker = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

const likersKey = (postId: string) => ["post-likers", postId] as const;

/**
 * Everyone who heart-liked a post, newest first. RLS: anyone who can read the
 * post can read its reaction rows, so this is a plain select — it powers both
 * the like count on the card and the "who liked" sheet.
 */
export function usePostLikers(postId: string, enabled = true) {
  return useQuery({
    queryKey: likersKey(postId),
    enabled: isSupabaseConfigured && Boolean(postId) && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<PostLiker[]> => {
      const { data, error } = await supabase
        .from("post_reactions")
        .select("user_id, created_at, profiles:user_id(display_name, username, avatar_url)")
        .eq("post_id", postId)
        .eq("reaction", LIKE_REACTION)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        user_id: string;
        created_at: string;
        profiles: { display_name: string; username: string; avatar_url: string | null } | null;
      }[];
      return rows.map((row) => ({
        userId: row.user_id,
        username: row.profiles?.username ?? "",
        displayName: row.profiles?.display_name ?? "Someone",
        avatarUrl: row.profiles?.avatar_url ?? null,
        createdAt: row.created_at
      }));
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
        // Upsert keeps an existing selfie row's media_url intact.
        const { error } = await supabase
          .from("post_reactions")
          .upsert({ post_id: postId, user_id: userId, reaction: LIKE_REACTION });
        if (error) throw error;
      } else {
        // Unlike must not wipe a selfie reaction that shares the row: rows with
        // a selfie keep the row (reaction → null), like-only rows delete.
        const { error: clearError } = await supabase
          .from("post_reactions")
          .update({ reaction: null })
          .eq("post_id", postId)
          .eq("user_id", userId)
          .not("media_url", "is", null);
        if (clearError) throw clearError;
        const { error } = await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId)
          .is("media_url", null);
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
      // The visible like count comes from the likers list — bump it optimistically.
      await queryClient.cancelQueries({ queryKey: likersKey(postId) });
      const previousLikers = queryClient.getQueryData<PostLiker[]>(likersKey(postId));
      if (userId) {
        queryClient.setQueryData<PostLiker[]>(likersKey(postId), (current) => {
          const rest = (current ?? []).filter((liker) => liker.userId !== userId);
          if (!liked) return rest;
          return [
            { userId, username: "", displayName: "You", avatarUrl: null, createdAt: new Date().toISOString() },
            ...rest
          ];
        });
      }
      return { previous, previousLikers, postId };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(myReactionsKey(userId), context.previous);
      }
      if (context?.previousLikers !== undefined) {
        queryClient.setQueryData(likersKey(variables.postId), context.previousLikers);
      }
    },
    onSettled: (_data, _error, variables) => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey: myReactionsKey(userId) });
        void queryClient.invalidateQueries({ queryKey: likersKey(variables.postId) });
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
