import { useEffect, useMemo, useState } from "react";

import { useMyCommunities } from "@/hooks/queries/useCommunities";
import { useMyProfile, useUserPosts, useUserStreak } from "@/hooks/queries/useProfile";
import { useStreakDays } from "@/hooks/queries/useStreakDays";
import { useTrophyRarity } from "@/hooks/queries/useTrophyRarity";
import { useUserLifts } from "@/hooks/queries/useUserLifts";
import { deriveAchievements, deriveProgress, emptyStats, type TrophyStats } from "@/lib/trophyEngine";
import { computeGymStreak } from "@/lib/streak";
import {
  categorySections,
  earnedEntries,
  earnedTrophyCount,
  tierLadder,
  type CategorySection,
  type EarnedEntry,
  type LadderRow
} from "@/lib/trophySelectors";
import { type TrophyDefinition } from "@/lib/trophies";
import { getSeenAchievementIds, markAchievementsSeen } from "@/lib/trophyStorage";

/**
 * Assembles the user's trophy state from live app data (posts, streak, home gym,
 * crew) in the user's LOCAL timezone, derives achievements + progress, and
 * exposes the Categories/Earned view models plus a live rarity map. Automatic
 * trophies with no wired data source (check-in time-of-day, holidays, weekend,
 * nomad, strength video) stay locked until those backends land.
 *
 * Demo behavior: Day One earned (dated from the first real post); the streak
 * ladder is fed by real streak data (only earns tiers at 7+). So the Earned tab
 * shows only Day One unless the user genuinely qualifies for more.
 */
export function useTrophies(targetUserId?: string | null) {
  const profile = useMyProfile();
  const ownId = profile.data?.id ?? null;
  const isOwn = !targetUserId || targetUserId === ownId;
  const userId = targetUserId ?? ownId;
  const posts = useUserPosts(userId);
  // useUserStreak works for self or friends (RLS); use it for any target.
  const streak = useUserStreak(userId);
  const streakDays = useStreakDays(userId);
  // Crew membership is only queryable for the signed-in user, so first-crew
  // only reflects on your own case.
  const communities = useMyCommunities();
  const lifts = useUserLifts(userId);
  const { live } = useTrophyRarity();

  const stats = useMemo<TrophyStats>(() => {
    const next: TrophyStats = emptyStats();
    const rows = posts.data ?? [];
    const gymStreak = computeGymStreak(streakDays.data ? streakDays.data.keys() : []);

    next.numbers.streakCurrent = gymStreak.count;
    next.numbers.streakBest = Math.max(streak.data?.longest_streak ?? 0, gymStreak.count);

    // Strength: best logged lift per exercise feeds the video-verified trophies.
    const best = lifts.data ?? {};
    next.numbers.benchMax = best.bench ?? 0;
    next.numbers.squatMax = best.squat ?? 0;
    next.numbers.deadliftMax = best.deadlift ?? 0;
    next.numbers.pullupMax = best.pullups ?? 0;
    next.numbers.pushupMax = best.pushups ?? 0;

    // Firsts — earned from real data.
    if (rows.length > 0) {
      next.flags.firstPost = true;
      const earliest = rows.reduce((min, p) => (p.created_at < min ? p.created_at : min), rows[0].created_at);
      next.dates["day-one"] = earliest;
    }
    if (isOwn && (communities.data ?? []).length > 0) {
      next.flags.firstCrew = true;
    }
    return next;
  }, [posts.data, streak.data, streakDays.data, communities.data, lifts.data, isOwn]);

  const achievements = useMemo(() => deriveAchievements(stats), [stats]);
  const progress = useMemo(() => deriveProgress(stats), [stats]);

  const sections = useMemo<CategorySection[]>(
    () => categorySections(achievements, progress, live),
    [achievements, progress, live]
  );
  const earned = useMemo<EarnedEntry[]>(() => earnedEntries(achievements, live), [achievements, live]);
  const earnedCount = useMemo(() => earnedTrophyCount(achievements), [achievements]);

  const ladderFor = useMemo(
    () => (def: TrophyDefinition): LadderRow[] => tierLadder(def, achievements, live),
    [achievements, live]
  );

  // Newly-earned detection for the unlock modal — celebrate each achievement
  // once, and only on your OWN case (never a friend's).
  const [newlyEarned, setNewlyEarned] = useState<EarnedEntry | null>(null);
  useEffect(() => {
    if (!isOwn || !userId || earned.length === 0) return;
    let cancelled = false;
    (async () => {
      const seen = await getSeenAchievementIds(userId);
      if (cancelled) return;
      const fresh = earned.filter((e) => !seen.has(e.key));
      if (fresh.length === 0) return;
      // On first-ever load, everything is "new" — don't spam; just record them.
      if (seen.size === 0) {
        void markAchievementsSeen(userId, earned.map((e) => e.key));
        return;
      }
      // Celebrate the newest, mark all fresh as seen.
      setNewlyEarned(fresh[0]);
      void markAchievementsSeen(userId, fresh.map((e) => e.key));
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwn, userId, earned]);

  return {
    sections,
    earned,
    earnedCount,
    ladderFor,
    live,
    achievements,
    progress,
    newlyEarned,
    dismissNewlyEarned: () => setNewlyEarned(null)
  };
}
