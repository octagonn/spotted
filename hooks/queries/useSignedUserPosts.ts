import { useQuery } from "@tanstack/react-query";

import { useUserPosts } from "@/hooks/queries/useProfile";
import { signedPostUrl } from "@/lib/supabase";

export type SignedPost = {
  id: string;
  media_url: string | null;
  caption: string | null;
  created_at: string;
  permanent: boolean;
  isDailyDrop: boolean;
};

/**
 * User posts with their private storage paths resolved to signed URLs, so a
 * post card can render the real photo instead of a gray placeholder.
 */
export function useSignedUserPosts(userId?: string | null) {
  const posts = useUserPosts(userId);
  const raw = posts.data;

  return useQuery({
    queryKey: ["signed-user-posts", userId, (raw ?? []).map((post) => post.id).join(",")],
    enabled: Boolean(userId) && Boolean(raw),
    queryFn: async (): Promise<SignedPost[]> => {
      return Promise.all(
        (raw ?? []).map(async (post) => {
          let media: string | null = post.media_url;
          if (media && !media.startsWith("http")) {
            try {
              media = await signedPostUrl(media);
            } catch {
              media = null;
            }
          }
          return {
            id: post.id,
            media_url: media,
            caption: post.caption,
            created_at: post.created_at,
            permanent: post.permanent,
            isDailyDrop: post.is_daily_drop
          };
        })
      );
    }
  });
}
