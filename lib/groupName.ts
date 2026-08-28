/**
 * Per-viewer group display name. A group with a custom title shows that title
 * to everyone; an unnamed group shows each viewer the OTHER members' first
 * names ("Ethan & Mason", "Ethan, Mason & Sam") — never their own, and never
 * the creator's perspective baked in for everybody.
 */
export function groupDisplayName(
  title: string | null | undefined,
  members: { id: string; name: string }[],
  viewerId: string | null | undefined
): string {
  const custom = title?.trim();
  if (custom) return custom;
  const firsts = members
    .filter((m) => m.id !== viewerId)
    .map((m) => m.name.split(" ")[0])
    .filter(Boolean);
  if (firsts.length === 0) return "Group";
  if (firsts.length === 1) return firsts[0];
  return `${firsts.slice(0, -1).join(", ")} & ${firsts[firsts.length - 1]}`.slice(0, 60);
}
