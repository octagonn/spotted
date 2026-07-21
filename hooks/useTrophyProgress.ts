import { useTrophies } from "@/hooks/useTrophies";

/**
 * Lightweight trophy summary for the profile "Trophies" stat. Delegates to
 * useTrophies (React Query dedupes the shared underlying queries) and exposes
 * just the earned count. The full case UI uses useTrophies directly.
 */
export function useTrophyProgress() {
  const { earnedCount, earned, progress } = useTrophies();
  return { earnedCount, earned, progress };
}
