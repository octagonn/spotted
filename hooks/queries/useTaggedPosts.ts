import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";

export type TaggedPost = {
  id: string;
  media_url: string | null;
  created_at: string;
};

/** Posts a user was tagged in (post_tags), newest first, with signed media. */
export function useTaggedPosts(userId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["tagged-posts", userId],
    enabled: isSupabaseConfigured && Boolean(userId) && enabled,
    queryFn: async (): Promise<TaggedPost[]> => {
      const { data, error } = await supabase
        .from("post_tags")
        .select("post:posts(id, media_url, created_at)")
        .eq("user_id", userId as string);
      if (error) throw error;
      const rows: TaggedPost[] = [];
      for (const item of (data ?? []) as unknown as {
        post: { id: string; media_url: string | null; created_at: string } | null;
      }[]) {
        if (!item.post?.media_url) continue;
        let media: string | null = item.post.media_url;
        if (media && !media.startsWith("http")) {
          try {
            media = await signedPostUrl(media);
          } catch {
            media = null;
          }
        }
        rows.push({ id: item.post.id, media_url: media, created_at: item.post.created_at });
      }
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  });
}
