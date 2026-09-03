import { Text } from "@/components/ui/Text";

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (60 * 24))}d ago`;
}

/**
 * The presence/activity portion only (no @username) as a plain string, for
 * folding into a parent's accessibilityLabel — the chat header collapses the
 * PresenceLine into its button, so it's spoken via the header instead.
 * Returns "" when there's nothing to announce.
 */
export function presenceStatus({
  typing,
  online,
  lastSeenAt,
  statusVisible
}: {
  typing: boolean;
  online: boolean;
  lastSeenAt: string | null;
  statusVisible: boolean;
}): string {
  if (typing) return "typing";
  if (statusVisible) {
    if (online) return "Active now";
    if (lastSeenAt) return `Active ${ago(lastSeenAt)}`;
  }
  return "";
}

/**
 * The header sub-line under a chat title: "typing…" wins, else the activity
 * status — "Active now" when online, "Active {t} ago" from the last-seen
 * timestamp, or the plain @username when status is hidden/unknown.
 */
export function PresenceLine({
  username,
  typing,
  online,
  lastSeenAt,
  statusVisible
}: {
  username?: string;
  typing: boolean;
  online: boolean;
  lastSeenAt: string | null;
  statusVisible: boolean;
}) {
  if (typing) {
    return (
      <Text accessibilityLiveRegion="polite" numberOfLines={1} variant="label" className="text-silver">
        typing…
      </Text>
    );
  }
  let label = username ? `@${username}` : "";
  const active = statusVisible && online;
  if (statusVisible) {
    if (online) label = "Active now";
    else if (lastSeenAt) label = `Active ${ago(lastSeenAt)}`;
  }
  if (!label) return null;
  return (
    <Text accessibilityLiveRegion="polite" numberOfLines={1} variant="meta" className={active ? "text-success" : ""}>
      {label}
    </Text>
  );
}
