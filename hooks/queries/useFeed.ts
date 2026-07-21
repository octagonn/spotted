import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { mockFeed } from "@/lib/mockData";
import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { FeedPost, Gym, Post, Profile } from "@/types/domain";

/** Feed page size — keyset pagination cursors on created_at (F1). */
const FEED_PAGE = 24;

type FeedRow = Post & {
  profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "avatar_blurred_url"> | null;
  gyms: Pick<Gym, "id" | "name" | "latitude" | "longitude"> | null;
  post_tags?: { profile: { username: string } | null }[] | null;
};

async function rowToFeedPost(row: FeedRow): Promise<FeedPost> {
  const profile = row.profiles ?? {
    id: row.user_id,
    username: "unknown",
    display_name: "Unknown",
    avatar_url: null,
    avatar_blurred_url: null
  };
  let mediaUrl = row.media_url;
  if (mediaUrl && !mediaUrl.startsWith("http")) {
    try {
      mediaUrl = await signedPostUrl(mediaUrl);
    } catch {
      mediaUrl = row.media_url;
    }
  }
  // Sign every carousel photo path.
  let mediaUrls = row.media_urls;
  if (mediaUrls?.length) {
    mediaUrls = await Promise.all(
      mediaUrls.map(async (path) => {
        if (path.startsWith("http")) return path;
        try {
          return await signedPostUrl(path);
        } catch {
          return path;
        }
      })
    );
  }
  const { profiles: _profiles, gyms: _gyms, post_tags: _tags, ...post } = row;
  return {
    ...post,
    media_url: mediaUrl,
    media_urls: mediaUrls,
    profile,
    gym: row.gyms,
    viewer_count: 0,
    tag_usernames: (row.post_tags ?? [])
      .map((tag) => tag.profile?.username)
      .filter((username): username is string => Boolean(username))
  };
}

/**
 * Feed pages, keyset-paginated on created_at DESC (F1) — strictly
 * reverse-chronological, no ranking or offset (offset duplicates/skips rows
 * when new posts land mid-scroll on a daily-post app). Each page fetches the
 * next FEED_PAGE posts older than the previous page's last post.
 */
export function useFeed() {
  const userId = useAuthStore((state) => state.userId);
  return useInfiniteQuery({
    queryKey: ["feed", userId],
    refetchOnWindowFocus: "always",
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedPost[]> => {
      if (!isSupabaseConfigured) {
        return pageParam ? [] : mockFeed;
      }
      let query = supabase
        .from("posts")
        .select(
          "*, profiles:user_id(id, username, display_name, avatar_url, avatar_blurred_url), gyms:gym_id(id, name, latitude, longitude), post_tags(profile:user_id(username))"
        )
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(FEED_PAGE);
      // Keyset cursor: everything strictly older than the last row we have.
      if (pageParam) query = query.lt("created_at", pageParam);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as FeedRow[];
      return Promise.all(rows.map(rowToFeedPost));
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < FEED_PAGE ? undefined : lastPage[lastPage.length - 1]?.created_at ?? undefined
  });
}

export function useMarkPostViewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) {
        return;
      }
      const { error } = await supabase.from("post_views").upsert({ post_id: postId, viewer_id: userId });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    }
  });
}
