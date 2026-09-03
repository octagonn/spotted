import { Lock } from "lucide-react-native";
import { View } from "react-native";

import { CommunityTile } from "@/components/communities/CommunityTile";
import { Button } from "@/components/ui/Button";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import type { CommunitySummary } from "@/hooks/queries/useCommunities";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Locked preview: name, member count, thumbnail — and nothing real, ever. */
export function LockedCommunitySheet({ community }: { community: CommunitySummary }) {
  const sheet = useSheet();
  return (
    <View style={{ paddingBottom: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4] + 4 }}>
        <CommunityTile community={community} size={48} locked />
        <View style={{ flex: 1, minWidth: 0 }}>
          <SheetTitle>{community.name}</SheetTitle>
          <Text variant="meta" className="-mt-[6px] px-5">
            {`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"}`}
          </Text>
        </View>
      </View>
      <View
        style={{
          marginHorizontal: space[4] + 4,
          marginTop: space[4],
          flexDirection: "row",
          gap: space[2] + 2,
          padding: space[3],
          borderRadius: radius.sm,
          backgroundColor: tokens.bg.raised
        }}
      >
        <Lock
          size={icon.size.xs}
          color={tokens.text.tertiary}
          strokeWidth={icon.stroke.regular}
          style={{ marginTop: 2 }}
        />
        <Text variant="meta" className="flex-1 text-silver">
          Board, feed and chat are members only. You&apos;ll only ever see them once you&apos;re a member —{" "}
          <Text variant="meta-strong" className="text-white">
            check in there to join.
          </Text>{" "}
          Browsing never unlocks it.
        </Text>
      </View>
      <View style={{ marginHorizontal: space[4] + 4, marginTop: space[4] }}>
        <Button variant="ghost" onPress={() => sheet.close()}>
          Got it
        </Button>
      </View>
    </View>
  );
}
