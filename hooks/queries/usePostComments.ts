import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export type PostComment = {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  text: string;
  createdAt: string;
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
        .select("id, user_id, content, created_at, profiles:user_id(username, display_name, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as {
        id: string;
        user_id: string;
        content: string;
        created_at: string;
        profiles: { username: string; display_name: string; avatar_url: string | null } | null;
      }[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.profiles?.display_name ?? "Someone",
        handle: row.profiles?.username ?? "someone",
        avatarUrl: row.profiles?.avatar_url ?? null,
        text: row.content,
        createdAt: row.created_at
      }));
    }
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (text: string) => {
      const trimmed = text.trim();
      if (!isSupabaseConfigured || !userId || !trimmed) return;
      const { error } = await supabase
        .from("post_comments")
        .insert({ post_id: postId, user_id: userId, content: trimmed.slice(0, 500) });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["post-comments", postId] })
  });
}
