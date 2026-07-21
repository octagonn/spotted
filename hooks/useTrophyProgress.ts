import { useMemo } from "react";

import { useMyProfile, useUserPosts } from "@/hooks/queries/useProfile";
import {
  DEMO_TROPHY_STATS,
  earnedTrophyCount,
  evaluateGroups,
  type TrophyStats
} from "@/lib/trophies";

/**
 * Trophy progress for the current user. For the prototype this returns the demo
 * state (Day One earned, streak at 1, everything else locked) so all three card
 * states render. Day One's earn date is filled from the user's first real post.
 *
 * When the strength/check-in/streak backends land, swap `DEMO_TROPHY_STATS` for
 * a stats object assembled from live data — the evaluator and UI stay the same.
 */
export function useTrophyProgress() {
  const profile = useMyProfile();
  const posts = useUserPosts(profile.data?.id);

  const stats = useMemo<TrophyStats>(() => {
    const next: TrophyStats = {
      numbers: { ...DEMO_TROPHY_STATS.numbers },
      flags: { ...DEMO_TROPHY_STATS.flags },
      dates: { ...DEMO_TROPHY_STATS.dates }
    };
    const rows = posts.data ?? [];
    if (rows.length > 0) {
      const earliest = rows.reduce((min, p) => (p.created_at < min ? p.created_at : min), rows[0].created_at);
      next.dates["day-one"] = earliest;
    }
    return next;
  }, [posts.data]);

  const groups = useMemo(() => evaluateGroups(stats), [stats]);
  const earnedCount = useMemo(() => earnedTrophyCount(stats), [stats]);

  return { groups, earnedCount, stats };
}
