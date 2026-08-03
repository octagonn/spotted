import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";

export type PostComment = {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  text: string;
  createdAt: string;
  /** Parent comment id when this is a reply (one level of threading). */
  parentId: string | null;
};

/** Real comments for a post (empty for fixture/demo posts). */
export function usePostComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["post-comments", postId],
    enabled: isSupabaseConfigured && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<PostComment[]> => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, user_id, content, created_at, parent_id, profiles:user_id(username, display_name, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string;
        user_id: string;
        content: string;
        created_at: string;
        parent_id: string | null;
        profiles: { username: string; display_name: string; avatar_url: string | null } | null;
      }[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.profiles?.display_name ?? "Someone",
        handle: row.profiles?.username ?? "someone",
        avatarUrl: row.profiles?.avatar_url ?? null,
        text: row.content,
        createdAt: row.created_at,
        parentId: row.parent_id ?? null
      }));
    }
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (input: string | { text: string; parentId?: string | null }) => {
      const text = typeof input === "string" ? input : input.text;
      const parentId = typeof input === "string" ? null : input.parentId ?? null;
      const trimmed = text.trim();
      if (!isSupabaseConfigured || !userId || !trimmed) return;
      const { error } = await supabase
        .from("post_comments")
        .insert({ post_id: postId, user_id: userId, content: trimmed.slice(0, 500), parent_id: parentId });
      if (error) throw error;
    },
    // Optimistic: the comment appears in the sheet the instant it's sent.
    onMutate: async (input) => {
      const text = typeof input === "string" ? input : input.text;
      const parentId = typeof input === "string" ? null : input.parentId ?? null;
      const trimmed = text.trim();
      if (!userId || !trimmed) return { prev: undefined };
      await queryClient.cancelQueries({ queryKey: ["post-comments", postId] });
      const prev = queryClient.getQueryData<PostComment[]>(["post-comments", postId]);
      // Best-effort identity from the cached own profile (name/avatar on the temp row).
      const myProfile = queryClient
        .getQueriesData<{ username?: string | null; display_name?: string | null; avatar_url?: string | null } | null>({
          queryKey: ["profile", "me"]
        })
        .map(([, data]) => data)
        .find(Boolean);
      const tempComment: PostComment = {
        id: `temp-${Date.now()}`,
        userId,
        name: myProfile?.display_name ?? "You",
        handle: myProfile?.username ?? "you",
        avatarUrl: myProfile?.avatar_url ?? null,
        text: trimmed.slice(0, 500),
        createdAt: new Date().toISOString(),
        parentId
      };
      queryClient.setQueryData<PostComment[]>(["post-comments", postId], (old) => [...(old ?? []), tempComment]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["post-comments", postId], ctx.prev);
      showToast("Couldn't post your comment");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["post-comments", postId] })
  });
}

/** Delete a comment. RLS allows the comment author OR the post owner. */
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    // Optimistic: the comment disappears instantly.
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["post-comments", postId] });
      const prev = queryClient.getQueryData<PostComment[]>(["post-comments", postId]);
      queryClient.setQueryData<PostComment[]>(["post-comments", postId], (old) =>
        (old ?? []).filter((comment) => comment.id !== commentId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["post-comments", postId], ctx.prev);
      showToast("Couldn't delete the comment");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["post-comments", postId] })
  });
}
