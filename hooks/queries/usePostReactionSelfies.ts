import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { compressReactionSelfie } from "@/lib/posts";

export type ReactionSelfie = {
  userId: string;
  name: string;
  username: string;
  /** The reactor's profile picture — shown for non-selfie (emoji/text) reactions. */
  avatarUrl: string | null;
  mediaUrl: string | null;
  /** The emoji they reacted with (null for selfie-only reactions). */
  emoji: string | null;
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
        .select("user_id, media_url, reaction, created_at, profiles:user_id(display_name, username, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as {
        user_id: string;
        media_url: string | null;
        reaction: string | null;
        profiles: { display_name: string; username: string; avatar_url: string | null } | null;
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
            avatarUrl: row.profiles?.avatar_url ?? null,
            mediaUrl,
            emoji: row.reaction ?? null,
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

/**
 * Remove YOUR OWN reaction from a post. The delete is scoped to the current
 * user (RLS `post_reactions_delete_self` enforces it server-side too), and the
 * UI updates optimistically — restored + a toast on failure.
 */
export function useRemoveReaction() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey: ["post-reactions", postId] });
      const prev = queryClient.getQueryData<ReactionSelfie[]>(["post-reactions", postId]);
      queryClient.setQueryData<ReactionSelfie[]>(["post-reactions", postId], (old) =>
        (old ?? []).filter((r) => !r.mine)
      );
      return { prev };
    },
    onError: (_err, { postId }, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["post-reactions", postId], ctx.prev);
    },
    onSettled: (_data, _err, { postId }) => {
      void queryClient.invalidateQueries({ queryKey: ["post-reactions", postId] });
    }
  });
}
