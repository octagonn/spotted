import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { rankFeed } from "@/lib/feedRanking";
import { mockFeed } from "@/lib/mockData";
import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { FeedPost, Gym, Post, Profile } from "@/types/domain";

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

export function useFeed() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["feed", userId],
    // Refetch on every app open/foreground (focusManager is wired to AppState).
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<FeedPost[]> => {
      if (!isSupabaseConfigured) {
        return mockFeed;
      }
      const { data: auth } = await supabase.auth.getUser();
      const viewerId = auth.user?.id ?? null;
      const [postsResult, viewsResult] = await Promise.all([
        supabase
          .from("posts")
          .select(
            "*, profiles:user_id(id, username, display_name, avatar_url, avatar_blurred_url), gyms:gym_id(id, name, latitude, longitude), post_tags(profile:user_id(username))"
          )
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(200),
        viewerId
          ? supabase.from("post_views").select("post_id").eq("viewer_id", viewerId)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (postsResult.error) {
        throw postsResult.error;
      }
      const rows = (postsResult.data ?? []) as unknown as FeedRow[];
      const posts = await Promise.all(rows.map(rowToFeedPost));
      const viewedPostIds = new Set((viewsResult.data ?? []).map((view: { post_id: string }) => view.post_id));
      return rankFeed(posts, { viewerId, viewedPostIds });
    }
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
