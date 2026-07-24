import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export type ReviewItem = {
  postId: string;
  userId: string;
  mediaUrl: string | null;
  insetUrl: string | null;
  score: number | null;
  createdAt: string;
};

/** True if the signed-in user is an app admin (gates the review queue). */
export function useIsAdmin() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_admin", { p_user: userId as string });
      if (error) return false;
      return Boolean(data);
    }
  });
}

/** Flagged posts awaiting admin review (signed thumbnails). */
export function useReviewQueue(enabled: boolean) {
  return useQuery({
    queryKey: ["review-queue"],
    enabled: isSupabaseConfigured && enabled,
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data, error } = await supabase.rpc("review_queue");
      if (error) throw error;
      const rows = (data ?? []) as {
        post_id: string;
        user_id: string;
        media_url: string | null;
        inset_url: string | null;
        moderation_score: { nsfw?: number } | null;
        created_at: string;
      }[];
      return Promise.all(
        rows.map(async (r) => ({
          postId: r.post_id,
          userId: r.user_id,
          mediaUrl: r.media_url && !r.media_url.startsWith("http") ? await signedPostUrl(r.media_url).catch(() => null) : r.media_url,
          insetUrl: r.inset_url && !r.inset_url.startsWith("http") ? await signedPostUrl(r.inset_url).catch(() => null) : r.inset_url,
          score: r.moderation_score?.nsfw ?? null,
          createdAt: r.created_at
        }))
      );
    }
  });
}

/** Admin: approve (restore) or reject (delete) a flagged post. */
export function useReviewResolve() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, approve }: { postId: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_resolve", { p_post: postId, p_approve: approve });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    }
  });
}
