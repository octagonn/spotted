import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrls, supabase } from "@/lib/supabase";
import { localDateKey } from "@/stores/ui";

export type StreakDay = {
  /** The daily-drop post id for that day — null once the post was deleted
   *  (the DAY still counts; the cell just has no photo). */
  postId: string | null;
  /** Signed, openable image URL for the post (thumbnail preview). */
  thumbUrl: string | null;
  /** Dual-camera selfie for that day, signed — rendered as a corner PIP so a
   *  dual post looks like a dual post on the calendar too. */
  insetUrl: string | null;
  /**
   * 'gym' = trained that day. 'rest' = a declared rest day, which FREEZES the
   * streak (bridges it) without counting toward the number. See
   * lib/streak.ts::computeGymStreak and the mark_rest_day RPC.
   */
  kind: "gym" | "rest";
};

/** Map of local-date key ("YYYY-MM-DD") → that day's gym record. */
export type StreakDayMap = Map<string, StreakDay>;

/** The keys that actually count toward a streak (rest days excluded). */
export function gymDayKeys(map: StreakDayMap | undefined): string[] {
  if (!map) return [];
  return [...map.entries()].filter(([, day]) => day.kind !== "rest").map(([key]) => key);
}

/** The declared rest days — they bridge a streak but never extend it. */
export function restDayKeys(map: StreakDayMap | undefined): string[] {
  if (!map) return [];
  return [...map.entries()].filter(([, day]) => day.kind === "rest").map(([key]) => key);
}

/**
 * The days the user went to the gym, from the gym_days LEDGER (written when a
 * daily post publishes). Reading the ledger instead of posts means deleting a
 * post no longer erases the day from the calendar or breaks the streak.
 */
export function useStreakDays(userId?: string | null) {
  return useQuery({
    queryKey: ["streak-days", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<StreakDayMap> => {
      const yearAgo = localDateKey(new Date(Date.now() - 400 * 86_400_000));
      const { data, error } = await supabase
        .from("gym_days")
        .select("day, post_id, kind, post:post_id(media_url, inset_url)")
        .eq("user_id", userId as string)
        .gte("day", yearAgo)
        .order("day", { ascending: false })
        .limit(500);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as {
        day: string;
        post_id: string | null;
        kind: string | null;
        post: { media_url: string | null; inset_url: string | null } | null;
      }[];

      // Sign EVERY path in ONE batch. This used to await signedPostUrl() per
      // path inside the loop, and that helper signs a SINGLE key per call — so
      // a full year of posts meant up to ~1000 sequential edge-function round
      // trips before the calendar could show anything. signedPostUrls batches,
      // de-dupes and reuses the signed-url cache.
      const signed = await signedPostUrls(
        rows.flatMap((row) => [row.post?.media_url, row.post?.inset_url])
      );
      const resolve = (path: string | null | undefined): string | null => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return signed.get(path) ?? null;
      };

      const map: StreakDayMap = new Map();
      for (const row of rows) {
        map.set(row.day, {
          postId: row.post_id,
          thumbUrl: resolve(row.post?.media_url),
          insetUrl: resolve(row.post?.inset_url),
          kind: row.kind === "rest" ? "rest" : "gym"
        });
      }
      return map;
    }
  });
}
