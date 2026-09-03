import { View } from "react-native";

import { TenureChip } from "@/components/communities/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import type { BoardRow } from "@/hooks/queries/useCommunitiesHome";
import { tenureBadge } from "@/lib/communityTenure";
import { relDay } from "@/lib/relDay";
import { space, tokens } from "@/theme/tokens";

type LeaderboardRowProps = {
  row: BoardRow;
  rank: number;
  metric: "streak" | "month_days";
  isMe: boolean;
  communityCreatedAt: string | null | undefined;
};

/** One board row: rank · avatar · name (+tenure) · last check-in · value + unit. Gold = top 3 or you. */
export function LeaderboardRow({ row, rank, metric, isMe, communityCreatedAt }: LeaderboardRowProps) {
  const badge = tenureBadge(row.joined_at, communityCreatedAt);
  const highlight = rank <= 3 || isMe;
  const unit = metric === "streak" ? "days" : "check-ins";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingVertical: space[2] + 2,
        paddingHorizontal: space[4],
        backgroundColor: isMe ? tokens.accent.goldSubtle : "transparent"
      }}
    >
      <Text variant="mono" className={`w-6 text-right ${highlight ? "text-gold" : ""}`}>
        {String(rank)}
      </Text>
      <Avatar name={row.name} uri={row.avatar_url} size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2 }}>
          <Text variant="username" numberOfLines={1} className="flex-shrink">
            {isMe ? "You" : row.name}
          </Text>
          {badge ? <TenureChip badge={badge} /> : null}
        </View>
        {row.last_day && metric === "streak" && row.streak > 0 ? (
          <Text variant="meta" className="mt-[1px]">{`last check-in ${relDay(row.last_day)}`}</Text>
        ) : null}
      </View>
      <Text variant="numeral-sm">
        {String(row[metric])}
        <Text variant="micro">{`  ${unit}`}</Text>
      </Text>
    </View>
  );
}
