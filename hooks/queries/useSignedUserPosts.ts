import { useQuery } from "@tanstack/react-query";

import type { FeedWorkout } from "@/components/post/WorkoutSlideCard";
import { useUserPosts } from "@/hooks/queries/useProfile";
import { signedPostUrl } from "@/lib/supabase";

export type SignedPost = {
  id: string;
  media_url: string | null;
  /** Every photo posted that day (signed) — first = cover. */
  media_urls: string[] | null;
  caption: string | null;
  created_at: string;
  permanent: boolean;
  isDailyDrop: boolean;
  /** Attached workout slides, oldest first (2nd+ of the day badged). */
  workouts: FeedWorkout[];
};

async function sign(path: string): Promise<string | null> {
  if (path.startsWith("http")) return path;
  try {
    return await signedPostUrl(path);
  } catch {
    return null;
  }
}

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
          const media = post.media_url ? await sign(post.media_url) : null;
          let mediaUrls: string[] | null = null;
          if (post.media_urls?.length) {
            const signed = await Promise.all(post.media_urls.map(sign));
            mediaUrls = signed.filter((u): u is string => Boolean(u));
          }
          return {
            id: post.id,
            media_url: media,
            media_urls: mediaUrls,
            caption: post.caption,
            created_at: post.created_at,
            permanent: post.permanent,
            isDailyDrop: post.is_daily_drop,
            workouts: toFeedWorkouts(post.attached_workouts)
          };
        })
      );
    }
  });
}
