import { View } from "react-native";

import { MemberCheck, TenureChip } from "@/components/communities/Badges";
import { CommunityTile } from "@/components/communities/CommunityTile";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { CommunitySummary } from "@/hooks/queries/useCommunities";
import type { TenureBadge } from "@/lib/communityTenure";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

export type HeroPresence =
  | { count: number; people: { id: string; name: string; avatar_url: string | null }[] }
  | null
  | undefined;

type CommunityHeroCardProps = {
  community: CommunitySummary;
  tenure: TenureBadge;
  presence: HeroPresence;
  chatLine: { text: string; quiet: boolean };
  unread: boolean;
  /** Board signal: your rank line, or today's check-in count. */
  boardLabel: string;
  boardValue: string;
  boardEmphasis: boolean;
  onOpen: () => void;
  onOpenChat: () => void;
  onOpenBoard: () => void;
};

function Signal({
  label,
  value,
  emphasis,
  gold,
  onPress,
  accessibilityLabel,
  divider
}: {
  label: string;
  value: string;
  emphasis: boolean;
  gold?: string;
  onPress: () => void;
  accessibilityLabel: string;
  divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="none"
      accessibilityLabel={accessibilityLabel}
      style={{
        flex: 1,
        padding: space[3],
        paddingHorizontal: space[3] + 2,
        borderRightWidth: divider ? 1 : 0,
        borderRightColor: tokens.border.default
      }}
    >
      <Text variant="micro">{label}</Text>
      <Text
        variant={emphasis ? "meta-strong" : "meta"}
        numberOfLines={1}
        className={`mt-1 ${emphasis ? "text-white" : ""}`}
      >
        {gold ? (
          <>
            {value.slice(0, value.indexOf(gold))}
            <Text variant="meta-strong" className="text-gold">
              {gold}
            </Text>
            {value.slice(value.indexOf(gold) + gold.length)}
          </>
        ) : (
          value
        )}
      </Text>
    </Pressable>
  );
}

/**
 * The gym you're at (or your home gym): the one raised card on the hub, with
 * live presence, the latest chat line, your board rank, and two actions.
 */
export function CommunityHeroCard({
  community,
  tenure,
  presence,
  chatLine,
  unread,
  boardLabel,
  boardValue,
  boardEmphasis,
  onOpen,
  onOpenChat,
  onOpenBoard
}: CommunityHeroCardProps) {
  const rankMatch = boardValue.match(/#\d+/)?.[0];
  return (
    <View
      style={{
        marginHorizontal: space[4],
        backgroundColor: tokens.bg.raised,
        borderRadius: radius.md,
        overflow: "hidden"
      }}
    >
      <Pressable onPress={onOpen} haptic="none" accessibilityLabel={`Open ${community.name}`}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3] + 2, paddingBottom: 0 }}
        >
          <CommunityTile community={community} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="subheading" numberOfLines={1}>
              {community.name}
            </Text>
            <View
              style={{
                marginTop: space[1],
                flexDirection: "row",
                alignItems: "center",
                gap: space[1] + 2,
                flexWrap: "wrap"
              }}
            >
              <MemberCheck />
              {tenure ? <TenureChip badge={tenure} /> : null}
              <Text variant="meta">{`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"}`}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      {/* Presence — rendered only when someone is actually there. */}
      {presence && presence.count > 0 ? (
        <View
          style={{
            margin: space[3] + 2,
            marginBottom: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: space[2] + 2,
            paddingVertical: space[2] + 2,
            paddingHorizontal: space[3],
            borderRadius: radius.sm,
            backgroundColor: colors.glass
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.status.success }} />
          <Text variant="meta" numberOfLines={2} className="flex-1 text-bone">
            <Text variant="meta-strong" className="text-white">
              {presence.people.map((p) => p.name.split(" ")[0]).join(", ")}
            </Text>
            {presence.count > presence.people.length ? ` and ${presence.count - presence.people.length} more` : ""}
            {presence.count === 1 ? " is here now" : " are here now"}
          </Text>
          <View style={{ flexDirection: "row" }}>
            {presence.people.map((p, i) => (
              <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar name={p.name} uri={p.avatar_url} size={26} borderColor={tokens.bg.raised} borderWidth={2} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View
        style={{
          marginTop: space[3] + 2,
          flexDirection: "row",
          borderTopWidth: 1,
          borderTopColor: tokens.border.default
        }}
      >
        <Signal
          label="Chat"
          value={chatLine.text}
          emphasis={!chatLine.quiet}
          onPress={onOpenChat}
          accessibilityLabel="Latest chat"
          divider
        />
        <Signal
          label={boardLabel}
          value={boardValue}
          emphasis={boardEmphasis}
          gold={rankMatch}
          onPress={onOpenBoard}
          accessibilityLabel="Board"
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: space[2],
          padding: space[3] + 2,
          paddingTop: space[3],
          borderTopWidth: 1,
          borderTopColor: tokens.border.default
        }}
      >
        <Button style={{ flex: 1 }} onPress={onOpenChat}>
          {unread ? "Open chat · new" : "Open chat"}
        </Button>
        <Button variant="ghost" style={{ flex: 1 }} onPress={onOpenBoard}>
          {community.type === "gym" ? "Board" : "Feed"}
        </Button>
      </View>
    </View>
  );
}
