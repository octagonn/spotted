/**
 * Relative day label (prototype `relDay`): Today / Yesterday / "3 days ago" /
 * "Jul 4" beyond a week.
 */
export function relDay(ts: string | number | Date): string {
  const then = new Date(ts);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d1 = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const days = Math.round((d0.getTime() - d1.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
