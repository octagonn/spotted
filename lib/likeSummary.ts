import type { PostLiker } from "@/hooks/queries/usePostReactions";

export type LikeSummary = {
  /** Emphasised lead name — "you", or whoever you're most likely to recognise. */
  lead: string;
  /** Second emphasised name, used only when exactly two people liked the post. */
  second?: string;
  /** People beyond the lead, when there are too many to name (0 otherwise). */
  others: number;
  /** Flat one-string version, for the accessibility label. */
  label: string;
};

function nameOf(liker: PostLiker): string {
  return liker.displayName?.trim() || liker.username?.trim() || "Someone";
}

/**
 * Builds Instagram's "Liked by <name> and N others" line.
 *
 * Which name leads matters: the line is only worth reading if you recognise it.
 * So it prefers YOU, then a friend, then whoever liked most recently (the
 * likers query returns newest-first). Two likers get both names rather than
 * "and 1 other", which is how Instagram renders it too.
 *
 * Returns null when nobody has liked the post — the caller renders nothing,
 * rather than an empty row that shifts the caption down.
 */
export function summarizeLikers(
  likers: readonly PostLiker[],
  myId: string | null,
  friendIds?: ReadonlySet<string>
): LikeSummary | null {
  if (!likers.length) return null;

  const mine = myId ? likers.find((liker) => liker.userId === myId) ?? null : null;
  const rest = likers.filter((liker) => liker.userId !== myId);
  const friend = friendIds ? rest.find((liker) => friendIds.has(liker.userId)) ?? null : null;
  const leadLiker = mine ?? friend ?? rest[0];
  if (!leadLiker) return null;

  const lead = mine ? "you" : nameOf(leadLiker);
  const remaining = likers.filter((liker) => liker.userId !== leadLiker.userId);

  if (remaining.length === 0) {
    return { lead, others: 0, label: `Liked by ${lead}` };
  }
  if (remaining.length === 1) {
    const second = nameOf(remaining[0]);
    return { lead, second, others: 0, label: `Liked by ${lead} and ${second}` };
  }
  return {
    lead,
    others: remaining.length,
    label: `Liked by ${lead} and ${remaining.length} others`
  };
}
