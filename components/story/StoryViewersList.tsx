import { Eye, Heart } from "lucide-react-native";
import { View } from "react-native";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";

import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { timeAgo } from "@/lib/notificationCopy";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

export type StoryViewerRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  viewedAt: string;
};

/** "Seen by N" — viewers of your own story, with a heart on the ones who liked it. */
export function StoryViewersList({
  viewers,
  loading,
  likedBy,
  onOpenUser
}: {
  viewers: StoryViewerRow[];
  loading: boolean;
  likedBy?: Set<string>;
  onOpenUser: (username: string) => void;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          paddingHorizontal: space[4] + 4,
          paddingTop: space[3],
          paddingBottom: space[2]
        }}
      >
        <Eye size={icon.size.xs + 1} color={colors.white} strokeWidth={icon.stroke.regular} />
        <Text variant="subheading">{`Seen by ${viewers.length}`}</Text>
      </View>
      {/* RNGH ScrollView: negotiates with the root story gestures, so the list
          actually scrolls instead of losing its touches to the pan handlers. */}
      <GHScrollView style={{ maxHeight: 360 }}>
        {loading ? (
          <SkeletonRows count={4} avatar={34} />
        ) : viewers.length === 0 ? (
          <Text variant="meta" className="px-6 py-4">
            No views yet.
          </Text>
        ) : (
          viewers.map((v) => (
            <UserRow
              key={v.id}
              name={v.display_name}
              avatarUrl={v.avatar_url}
              sub={`@${v.username}`}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  {likedBy?.has(v.id) ? (
                    <Heart
                      size={icon.size.xs}
                      color={tokens.status.like}
                      fill={tokens.status.like}
                      strokeWidth={icon.stroke.regular}
                    />
                  ) : null}
                  <Text variant="mono">{timeAgo(v.viewedAt)}</Text>
                </View>
              }
              onPress={() => onOpenUser(v.username)}
            />
          ))
        )}
      </GHScrollView>
    </View>
  );
}
