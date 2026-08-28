import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrls, supabase } from "@/lib/supabase";

export type TaggedPost = {
  id: string;
  media_url: string | null;
  /** "image" | "video" — video cells must render the poster + play badge. */
  media_type: string;
  /** Signed poster frame for video posts. */
  thumbnail_url: string | null;
  created_at: string;
  /** The post OWNER — tagged posts belong to other users, and the viewer
   *  route needs the owner's id to open the right feed. */
  user_id: string;
};

/** Posts a user was tagged in (post_tags), newest first, with signed media. */
export function useTaggedPosts(userId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["tagged-posts", userId],
    enabled: isSupabaseConfigured && Boolean(userId) && enabled,
    queryFn: async (): Promise<TaggedPost[]> => {
      const { data, error } = await supabase
        .from("post_tags")
        .select("post:posts(id, user_id, media_url, media_type, thumbnail_url, created_at)")
        .eq("user_id", userId as string);
      if (error) throw error;
      type Row = {
        post: {
          id: string;
          user_id: string;
          media_url: string | null;
          media_type: string | null;
          thumbnail_url: string | null;
          created_at: string;
        } | null;
      };
      const posts = ((data ?? []) as unknown as Row[]).map((item) => item.post).filter((p): p is NonNullable<Row["post"]> => Boolean(p?.media_url));
      // One batched sign for media + video posters (media_url alone left video
      // cells black — a video file can't render through expo-image).
      const signed = await signedPostUrls(posts.flatMap((p) => [p.media_url, p.thumbnail_url]));
      const resolve = (path: string | null): string | null => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return signed.get(path) ?? null;
      };
      return posts
        .map((p) => ({
          id: p.id,
          user_id: p.user_id,
          media_url: resolve(p.media_url),
          media_type: p.media_type ?? "image",
          thumbnail_url: resolve(p.thumbnail_url),
          created_at: p.created_at
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  });
}
