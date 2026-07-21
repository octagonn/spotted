import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { localDateKey } from "@/stores/ui";

export type StreakDay = {
  /** The daily-drop post id for that day. */
  postId: string;
  /** Signed, openable image URL for the post (thumbnail preview). */
  thumbUrl: string | null;
};

/** Map of local-date key ("YYYY-MM-DD") → that day's gym post preview. */
export type StreakDayMap = Map<string, StreakDay>;

/**
 * The days the user went to the gym — i.e. days with a daily-drop post — keyed
 * by local date, each carrying a signed thumbnail so the streak calendar can
 * render a small preview of that day's post with the date over it.
 */
export function useStreakDays(userId?: string | null) {
  return useQuery({
    queryKey: ["streak-days", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<StreakDayMap> => {
      const yearAgo = new Date(Date.now() - 400 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("posts")
        .select("id, media_url, created_at")
        .eq("user_id", userId as string)
        .eq("is_daily_drop", true)
        .gte("created_at", yearAgo)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        throw error;
      }
      const map: StreakDayMap = new Map();
      for (const row of data ?? []) {
        const key = localDateKey(new Date(row.created_at));
        // Newest first, so the first row for a day wins (keep one per day).
        if (map.has(key)) {
          continue;
        }
        let thumbUrl: string | null = row.media_url;
        if (thumbUrl && !thumbUrl.startsWith("http")) {
          try {
            thumbUrl = await signedPostUrl(thumbUrl);
          } catch {
            thumbUrl = null;
          }
        }
        map.set(key, { postId: row.id, thumbUrl });
      }
      return map;
    }
  });
}
