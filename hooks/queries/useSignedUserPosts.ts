import { useQuery } from "@tanstack/react-query";

import type { FeedWorkout } from "@/components/post/WorkoutSlideCard";
import { useUserPosts } from "@/hooks/queries/useProfile";
import { signedPostUrls } from "@/lib/supabase";

export type SignedPost = {
  id: string;
  media_url: string | null;
  inset_url: string | null;
  /** The post HAS media even if signing failed this fetch — grids should show
   *  a placeholder tile, not silently drop the post. */
  hasMedia: boolean;
  /** Every photo posted that day (signed) — first = cover. */
  media_urls: string[] | null;
  caption: string | null;
  created_at: string;
  permanent: boolean;
  isDailyDrop: boolean;
  /** Attached workout slides, oldest first (2nd+ of the day badged). */
  workouts: FeedWorkout[];
};

/** Attached-workout rows → feed slide shape (same mapping as useFeed). */
function toFeedWorkouts(
  rows: { id: string; name: string; duration_seconds: number; started_at: string; data: unknown }[] | null | undefined
): FeedWorkout[] {
  return (rows ?? [])
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
      isSecond: i > 0
    }));
}

/**
 * User posts with their private storage paths resolved to signed URLs, plus
 * carousel photos and attached workout slides — so opening an archive post
 * shows EVERYTHING from that day, not just the cover photo.
 *
 * Signing is BATCHED (one storage call, retried inside signedPostUrls) and a
 * failed sign resolves to null — never a raw storage path, which can't load
 * and leaves recycled list images showing the wrong photo.
 */
export function useSignedUserPosts(userId?: string | null) {
  const posts = useUserPosts(userId);
  const raw = posts.data;

  return useQuery({
    queryKey: ["signed-user-posts", userId, (raw ?? []).map((post) => post.id).join(",")],
    enabled: Boolean(userId) && Boolean(raw),
    queryFn: async (): Promise<SignedPost[]> => {
      const rows = raw ?? [];
      const signed = await signedPostUrls(rows.flatMap((post) => [post.media_url, post.inset_url, ...(post.media_urls ?? [])]));
      const resolve = (path: string | null | undefined): string | null => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return signed.get(path) ?? null;
      };
      return rows.map((post) => ({
        id: post.id,
        media_url: resolve(post.media_url),
        inset_url: resolve(post.inset_url),
        hasMedia: Boolean(post.media_url),
        media_urls: post.media_urls?.length
          ? post.media_urls.map(resolve).filter((u): u is string => Boolean(u))
          : null,
        caption: post.caption,
        created_at: post.created_at,
        permanent: post.permanent,
        isDailyDrop: post.is_daily_drop,
        workouts: toFeedWorkouts(post.attached_workouts)
      }));
    }
  });
}
