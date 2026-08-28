/**
 * Tenure badges (Communities spec): exactly two, so they stay a mark of
 * belonging rather than a leaderboard of their own.
 *
 *  - "day1"     — joined on the community's launch day (same UTC calendar day
 *                 as the community was created)
 *  - "founding" — joined during the community's first 30 days
 *
 * Day 1 implies Founding; the more specific one wins.
 */
export type TenureBadge = "day1" | "founding" | null;

const DAY_MS = 86_400_000;
const FOUNDING_WINDOW_MS = 30 * DAY_MS;

export function tenureBadge(joinedAt: string | null | undefined, communityCreatedAt: string | null | undefined): TenureBadge {
  if (!joinedAt || !communityCreatedAt) return null;
  const joined = new Date(joinedAt);
  const created = new Date(communityCreatedAt);
  const j = joined.getTime();
  const c = created.getTime();
  if (!Number.isFinite(j) || !Number.isFinite(c)) return null;
  if (joined.toISOString().slice(0, 10) === created.toISOString().slice(0, 10)) return "day1";
  if (j >= c && j - c < FOUNDING_WINDOW_MS) return "founding";
  return null;
}

export const TENURE_LABEL: Record<Exclude<TenureBadge, null>, string> = {
  day1: "Day 1",
  founding: "Founding"
};
