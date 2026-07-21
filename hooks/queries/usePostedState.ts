import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { localDateKey, usePostedToday, usePostedWithinDays } from "@/stores/ui";

const WEEK_MS = 7 * 86_400_000;

/**
 * Posted-state that follows server truth, not just this device. The local
 * AsyncStorage flag (set right after publishing) gives an instant optimistic
 * unlock; the DB query makes the state correct across devices/reinstalls —
 * without it, a user who posted on their phone sees a locked feed everywhere
 * else.
 */
export function usePostedState(): { postedToday: boolean; postedThisWeek: boolean } {
  const userId = useAuthStore((state) => state.userId);
  const localToday = usePostedToday();
  const localWeek = usePostedWithinDays(7);

  const latest = useQuery({
    queryKey: ["my-latest-post", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("posts")
        .select("created_at")
        .eq("user_id", userId as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data?.created_at ?? null;
    }
  });

  let serverToday = false;
  let serverThisWeek = false;
  if (latest.data) {
    const created = new Date(latest.data);
    serverToday = localDateKey(created) === localDateKey();
    serverThisWeek = Date.now() - created.getTime() < WEEK_MS;
  }

  return {
    postedToday: localToday || serverToday,
    postedThisWeek: localWeek || serverThisWeek
  };
}
