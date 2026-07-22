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
  photo_tags?: { x: number; y: number; profile: { username: string } | null }[] | null;
  answered_taunts?: { sender: { username: string } | null }[] | null;
  attached_workouts?: { id: string; name: string; duration_seconds: number; started_at: string; data: unknown }[] | null;
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
  const { profiles: _profiles, gyms: _gyms, post_tags: _tags, photo_tags: _ptags, answered_taunts: _ans, attached_workouts: _wk, ...post } = row;
  return {
    ...post,
    media_url: mediaUrl,
    media_urls: mediaUrls,
    profile,
    gym: row.gyms,
    viewer_count: 0,
    tag_usernames: (row.post_tags ?? [])
      .map((tag) => tag.profile?.username)
      .filter((username): username is string => Boolean(username)),
    photo_tags: (row.photo_tags ?? [])
      .filter((t) => t.profile?.username)
      .map((t) => ({ username: t.profile!.username, x: t.x, y: t.y })),
    // "Answered the Call" (spec B): who taunted this poster into showing up.
    answered_call: (row.answered_taunts ?? []).map((t) => t.sender?.username).find(Boolean) ?? null,
    // Workouts attached to this daily post — rendered as extra feed slides.
    attached_workouts: (row.attached_workouts ?? [])
      .slice()
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
      .map((w, i) => ({
        id: w.id,
        name: w.name,
        durationSeconds: w.duration_seconds,
        exercises: (() => {
          const d = w.data as { exercises?: unknown } | unknown[] | null;
          if (Array.isArray(d)) return d as never;
          return (d && typeof d === "object" && Array.isArray((d as { exercises?: unknown }).exercises)
            ? (d as { exercises: unknown }).exercises
            : []) as never;
        })(),
        // A second+ workout of the day (attached after the post) gets a badge.
        isSecond: i > 0
      }))
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
      // The main feed shows only TODAY's posts — anything from a previous day
      // disappears at LOCAL midnight (BeReal-style daily reset), matching the
      // feed lock. Profile archives keep full history (separate query).
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      let query = supabase
        .from("posts")
        .select(
          "*, profiles:user_id(id, username, display_name, avatar_url, avatar_blurred_url), gyms:gym_id(id, name, latitude, longitude), post_tags(profile:user_id(username)), photo_tags(x, y, profile:user_id(username)), answered_taunts:taunts!taunts_answered_post_id_fkey(sender:sender_id(username)), attached_workouts:workouts!workouts_post_id_fkey(id, name, duration_seconds, started_at, data)"
        )
        .gte("created_at", startOfDay.toISOString())
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
      // Local session state — auth.getUser() is a network round-trip per call.
      const userId = useAuthStore.getState().userId;
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
