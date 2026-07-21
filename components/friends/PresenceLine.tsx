import { Text } from "react-native";

import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (60 * 24))}d ago`;
}

/**
 * The header sub-line under a chat title: "typing…" (#12) wins, else the
 * activity status (#13) — "Active now" when online, "Active {t} ago" from the
 * last-seen timestamp, or the plain @username when status is hidden/unknown.
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
      <Text numberOfLines={1} style={{ marginTop: 1, fontFamily: "Geist_600SemiBold", fontSize: 11.5, color: tokens.accent.gold }}>
        typing…
      </Text>
    );
  }
  let label = username ? `@${username}` : "";
  if (statusVisible) {
    if (online) label = "Active now";
    else if (lastSeenAt) label = `Active ${ago(lastSeenAt)}`;
  }
  if (!label) return null;
  return (
    <Text numberOfLines={1} style={{ marginTop: 1, fontFamily: "GeistMono_400Regular", fontSize: 11, color: online && statusVisible ? "#22C55E" : colors.fog }}>
      {label}
    </Text>
  );
}
