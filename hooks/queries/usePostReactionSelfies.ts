import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { compressReactionSelfie } from "@/lib/posts";

export type ReactionSelfie = {
  userId: string;
  name: string;
  username: string;
  mediaUrl: string | null;
  mine: boolean;
};

/**
 * Live-reaction selfies for a post, newest first, with signed selfie URLs and
 * reactor identities. This is what makes a friend's reaction show on your feed
 * (previously reactions lived only in local session state).
 */
export function usePostReactionSelfies(postId: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["post-reactions", postId],
    enabled: isSupabaseConfigured && Boolean(postId),
    staleTime: 30_000,
    queryFn: async (): Promise<ReactionSelfie[]> => {
      const { data, error } = await supabase
        .from("post_reactions")
        .select("user_id, media_url, created_at, profiles:user_id(display_name, username)")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as {
        user_id: string;
        media_url: string | null;
        profiles: { display_name: string; username: string } | null;
      }[];
      return Promise.all(
        rows.map(async (row) => {
          let mediaUrl: string | null = row.media_url;
          if (mediaUrl && !mediaUrl.startsWith("http")) {
            try {
              const { data: signed } = await supabase.storage
                .from("reactions")
                .createSignedUrl(mediaUrl, 60 * 60);
              mediaUrl = signed?.signedUrl ?? null;
            } catch {
              mediaUrl = null;
            }
          }
          return {
            userId: row.user_id,
            name: row.profiles?.display_name ?? "Someone",
            username: row.profiles?.username ?? "someone",
            mediaUrl,
            mine: row.user_id === userId
          };
        })
      );
    }
  });
}

/** Upload the reaction selfie (if any) and upsert the reaction row. */
export function useAddReactionSelfie() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ postId, selfieUri }: { postId: string; selfieUri: string | null }) => {
      if (!isSupabaseConfigured || !userId) {
        return;
      }
      let mediaPath: string | null = null;
      if (selfieUri) {
        const uploadUri = await compressReactionSelfie(selfieUri);
        const response = await fetch(uploadUri);
        const body = await response.arrayBuffer();
        if (body.byteLength > 0) {
          const path = `${userId}/${postId}.jpg`;
          const upload = await supabase.storage.from("reactions").upload(path, body, {
            contentType: "image/jpeg",
            upsert: true
          });
          if (!upload.error) {
            mediaPath = path;
          }
        }
      }
      // `reaction` is intentionally omitted: on a fresh insert it stays null
      // (selfie-only), and on conflict it doesn't clobber an existing like.
      const { error } = await supabase
        .from("post_reactions")
        .upsert({ post_id: postId, user_id: userId, media_url: mediaPath });
      if (error) {
        throw error;
      }
    },
    onSuccess: (_data, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ["post-reactions", postId] });
    }
  });
}
