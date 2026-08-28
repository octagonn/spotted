import { useMemo } from "react";

import { useMyProfile } from "@/hooks/queries/useProfile";
import { toAchievements, toProgress, useEarnedTrophies, useTrophyCatalog, useTrophyProgressRows } from "@/hooks/queries/useTrophyCatalog";
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

/**
 * A user's trophy state, entirely from the server: definitions
 * (`trophy_definitions`), earned rows (`user_trophies`, written only by the
 * SQL engine), live progress (`trophy_progress` RPC) and rarity
 * (`trophy_rarity_stats`, refreshed daily). Nothing is derived on the client
 * anymore, so your case and a friend's case are the same truth.
 *
 * Earn moments are no longer detected here — `TrophyEarnHost` listens for
 * new `user_trophies` rows in realtime and fires the full-screen celebration
 * for every tier, every time.
 */
export function useTrophies(targetUserId?: string | null) {
  const profile = useMyProfile();
  const ownId = profile.data?.id ?? null;
  const userId = targetUserId ?? ownId;

  const { catalog, rowByKey, live, isLoading: catalogLoading } = useTrophyCatalog();
  const earnedRows = useEarnedTrophies(userId);
  const progressRows = useTrophyProgressRows(userId);

  const achievements = useMemo(() => toAchievements(earnedRows.data ?? [], rowByKey), [earnedRows.data, rowByKey]);
  const progress = useMemo(
    () => toProgress(progressRows.data ?? [], catalog, achievements),
    [progressRows.data, catalog, achievements]
  );

  const sections = useMemo<CategorySection[]>(
    () => (catalog.length ? categorySections(achievements, progress, live) : []),
    [catalog, achievements, progress, live]
  );
  const earned = useMemo<EarnedEntry[]>(() => (catalog.length ? earnedEntries(achievements, live) : []), [catalog, achievements, live]);
  const earnedCount = useMemo(() => earnedTrophyCount(achievements), [achievements]);

  const ladderFor = useMemo(
    () => (def: TrophyDefinition): LadderRow[] => tierLadder(def, achievements, live),
    [achievements, live]
  );

  return {
    sections,
    earned,
    earnedCount,
    ladderFor,
    live,
    achievements,
    progress,
    isLoading: catalogLoading || earnedRows.isLoading,
    /** Kept for API compatibility — celebrations now come from TrophyEarnHost. */
    newlyEarned: null as EarnedEntry | null,
    dismissNewlyEarned: () => undefined
  };
}
