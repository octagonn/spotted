import { useMemo, useState } from "react";
import { View } from "react-native";

import { LeaderboardRow } from "@/components/communities/LeaderboardRow";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { rankBoard, type BoardRow } from "@/hooks/queries/useCommunitiesHome";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

const OPTIONS = ["Streak", "This month"];

/** Gym leaderboard: metric toggle · top 25 · your row pinned when outside it. */
export function CommunityBoard({
  rows,
  loading,
  userId,
  communityCreatedAt
}: {
  rows: BoardRow[] | undefined;
  loading: boolean;
  userId: string | null;
  communityCreatedAt: string | null | undefined;
}) {
  const [option, setOption] = useState(OPTIONS[0]);
  const metric = option === "Streak" ? "streak" : "month_days";
  const ranked = useMemo(() => rankBoard(rows ?? [], metric), [rows, metric]);
  const mine = ranked.find((r) => r.row.user_id === userId);
  const top = ranked.slice(0, 25);
  const mineInTop = mine ? top.some((r) => r.row.user_id === userId) : true;

  if (loading) return <SkeletonRows count={5} avatar={32} />;
  return (
    <View style={{ paddingTop: space[2] + 2 }}>
      <Segmented variant="quiet" options={OPTIONS} value={option} onChange={setOption} style={{ marginTop: 0 }} />
      <Text variant="micro" className="px-4 pb-2 pt-2">
        {metric === "streak" ? "Gym days in a row · this gym only" : "Check-in days this month · this gym only"}
      </Text>
      {ranked.length === 0 ? (
        <Text variant="meta" className="px-8 pt-6 text-center">
          No check-ins here yet. First one on the board wins.
        </Text>
      ) : (
        <View>
          {top.map(({ row, rank }, index) => (
            <View key={row.user_id}>
              {index > 0 ? (
                <View style={{ height: 1, marginHorizontal: space[4], backgroundColor: colors.graphite }} />
              ) : null}
              <LeaderboardRow
                row={row}
                rank={rank}
                metric={metric}
                isMe={row.user_id === userId}
                communityCreatedAt={communityCreatedAt}
              />
            </View>
          ))}
          {mine && !mineInTop ? (
            <>
              <View style={{ height: space[2], backgroundColor: colors.black }} />
              <LeaderboardRow
                row={mine.row}
                rank={mine.rank}
                metric={metric}
                isMe
                communityCreatedAt={communityCreatedAt}
              />
            </>
          ) : null}
        </View>
      )}
      <Text variant="meta" className="px-4 pt-3">
        Streaks and check-ins here count only days at this gym. Your profile streak is unchanged.
      </Text>
    </View>
  );
}
