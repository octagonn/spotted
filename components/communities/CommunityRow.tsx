import type { ReactNode } from "react";
import { View } from "react-native";

import { MemberCheck } from "@/components/communities/Badges";
import { CommunityTile } from "@/components/communities/CommunityTile";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { CommunitySummary } from "@/hooks/queries/useCommunities";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

type CommunityRowProps = {
  community: CommunitySummary;
  /** `member` shows the ✓ disc; `locked` dims the tile. */
  state?: "member" | "locked" | "joinable";
  sub?: ReactNode;
  /** Trailing slot: time + unread, a Preview/Join pill, a lock glyph… */
  right?: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
};

/** One community in a list: tile · name (+ member check) · sub · trailing. */
export function CommunityRow({
  community,
  state = "joinable",
  sub,
  right,
  onPress,
  accessibilityLabel
}: CommunityRowProps) {
  return (
    <Pressable onPress={onPress} haptic="none" accessibilityLabel={accessibilityLabel}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingVertical: space[2] + 2,
          paddingHorizontal: space[4]
        }}
      >
        <CommunityTile community={community} size={44} locked={state === "locked"} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2 }}>
            <Text variant="username" numberOfLines={1} className="flex-shrink">
              {community.name}
            </Text>
            {state === "member" ? <MemberCheck /> : null}
          </View>
          {sub ? (
            typeof sub === "string" ? (
              <Text variant="meta" numberOfLines={1} className="mt-[2px]">
                {sub}
              </Text>
            ) : (
              sub
            )
          ) : null}
        </View>
        {right}
      </View>
    </Pressable>
  );
}

/** Hairline between community rows (inset to the gutter). */
export function CommunityDivider() {
  return <View style={{ height: 1, backgroundColor: colors.graphite, marginHorizontal: space[4] }} />;
}
