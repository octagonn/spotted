import { useRouter, type Href } from "expo-router";
import { Check, Flame, UserPlus } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { ScrollView, View } from "react-native";

import { TauntSheet } from "@/components/post/TauntSheet";
import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { orderForRail, useNotSpotted, type NotSpottedFriend } from "@/hooks/queries/useNotSpotted";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

// Same geometry the stories rail had, so the feed header doesn't move.
const AVATAR = 64;
const RING = 2;
const GAP = 2;
const ITEM = 72;
const BADGE = 22;

/** Below this many friends the rail can't do its job — show the add tile. */
const THIN_CREW = 3;

// "taunted" never reaches the rail (orderForRail drops those for the day) but
// stays in the vocabulary so a stale cache entry still renders sanely.
type TileState = "open" | "taunted" | "went";

function stateOf(friend: NotSpottedFriend): TileState {
  if (friend.went_today) return "went";
  if (friend.taunted_by_me_today) return "taunted";
  return "open";
}

function Ring({ state, children }: { state: TileState; children: React.ReactNode }) {
  const border = state === "went" ? tokens.accent.gold : state === "taunted" ? tokens.text.primary : tokens.border.strong;
  return (
    <View
      style={{
        width: AVATAR + (RING + GAP) * 2,
        height: AVATAR + (RING + GAP) * 2,
        borderRadius: radius.pill,
        borderWidth: RING,
        borderColor: border,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </View>
  );
}

/** Bottom-right badge: gold ✓ (showed up) · white ✓ (taunt sent) · 🔥 streak (at risk). */
function Badge({ friend, state }: { friend: NotSpottedFriend; state: TileState }) {
  if (state === "went") {
    return (
      <View style={[badgeBase, { backgroundColor: tokens.accent.gold }]}>
        <Check size={13} color={colors.black} strokeWidth={3} />
      </View>
    );
  }
  if (state === "taunted") {
    return (
      <View style={[badgeBase, { backgroundColor: colors.white }]}>
        <Check size={13} color={colors.black} strokeWidth={3} />
      </View>
    );
  }
  if (friend.current_streak > 0) {
    return (
      <View style={[badgeBase, { backgroundColor: tokens.bg.raised, flexDirection: "row", paddingHorizontal: 5, width: undefined }]}>
        <Flame size={11} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />
        <Text variant="micro" className="text-white normal-case tracking-normal">
          {String(friend.current_streak)}
        </Text>
      </View>
    );
  }
  return null;
}

const badgeBase = {
  position: "absolute" as const,
  right: -2,
  bottom: -2,
  minWidth: BADGE,
  width: BADGE,
  height: BADGE,
  borderRadius: radius.pill,
  borderWidth: 2,
  borderColor: colors.black,
  alignItems: "center" as const,
  justifyContent: "center" as const
};

function Tile({ friend, onPress }: { friend: NotSpottedFriend; onPress: () => void }) {
  const state = stateOf(friend);
  const name = friend.display_name?.trim() || friend.username;
  const caption = state === "went" ? "Showed up" : state === "taunted" ? "Taunted" : "Taunt";
  const a11y =
    state === "went"
      ? `${name} showed up today`
      : state === "taunted"
        ? `${name}, taunted — waiting on their post`
        : `Taunt ${name}${friend.current_streak > 0 ? `, ${friend.current_streak}-day streak at risk` : ""}`;
  return (
    <Pressable
      haptic={state === "open" ? "selection" : "none"}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{ width: ITEM, alignItems: "center" }}
    >
      <View>
        <Ring state={state}>
          <Avatar name={name} uri={friend.avatar_url} size={AVATAR} muted={state === "went"} />
        </Ring>
        <Badge friend={friend} state={state} />
      </View>
      <Text variant="label" numberOfLines={1} className="mt-1.5 text-white">
        {friend.username}
      </Text>
      <Text
        variant="micro"
        numberOfLines={1}
        className={state === "went" ? "text-gold" : state === "taunted" ? "text-fog" : "text-silver"}
      >
        {caption}
      </Text>
    </Pressable>
  );
}

function AddTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      haptic="none"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add friends"
      style={{ width: ITEM, alignItems: "center" }}
    >
      <View
        style={{
          width: AVATAR + (RING + GAP) * 2,
          height: AVATAR + (RING + GAP) * 2,
          borderRadius: radius.pill,
          borderWidth: RING,
          borderColor: tokens.border.default,
          borderStyle: "dashed",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <UserPlus size={icon.size.md} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
      </View>
      <Text variant="label" numberOfLines={1} className="mt-1.5 text-white">
        Add friends
      </Text>
      <Text variant="micro" numberOfLines={1} className="text-silver">
        More to taunt
      </Text>
    </Pressable>
  );
}

function SkeletonTile() {
  return (
    <View style={{ width: ITEM, alignItems: "center" }}>
      <View
        style={{
          width: AVATAR + (RING + GAP) * 2,
          height: AVATAR + (RING + GAP) * 2,
          borderRadius: radius.pill,
          backgroundColor: tokens.bg.raised
        }}
      />
      <View style={{ marginTop: 6, width: 44, height: 12, borderRadius: radius.pill, backgroundColor: tokens.bg.raised }} />
    </View>
  );
}

/**
 * "Not spotted yet" — the home-feed rail in the slot stories used to occupy.
 * Friends sorted so the people a taunt can still change come first
 * (streak-at-risk → no streak → showed up). Tapping an open tile opens the
 * taunt sheet; a gold one goes to their profile. Hidden: rest-day friends (a
 * declared rest day is an answer) and anyone already taunted today — the
 * tile leaves the moment Send is tapped and comes back gold when they post.
 * The header counts still cover the whole crew, so "2 of 5 showed up" stays
 * true even when three tiles are gone.
 *
 * Only visible once the viewer has posted — the LockOverlay covers the whole
 * feed until then and carries its own "you've been taunted" strip.
 */
export function NotSpottedRail() {
  const router = useRouter();
  const sheet = useSheet();
  const query = useNotSpotted();
  // crew = everyone who's in play today (rest days out); tiles = what we draw.
  const crew = useMemo(() => (query.data ?? []).filter((f) => !f.rest_today), [query.data]);
  const tiles = useMemo(() => orderForRail(query.data ?? []), [query.data]);

  const wentCount = crew.filter((f) => f.went_today).length;
  const openCount = crew.length - wentCount;
  const waitingCount = crew.filter((f) => !f.went_today && f.taunted_by_me_today).length;
  const everyoneWent = crew.length > 0 && openCount === 0;
  // Every open friend has already been taunted — nothing left to tap.
  const allTaunted = openCount > 0 && waitingCount === openCount;

  // One impression per mount once data is in — the metric the rail is judged on.
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current || !query.data) return;
    logged.current = true;
    trackAnalyticsEvent("taunt_rail_impression", { friends: crew.length, open: openCount });
  }, [query.data, crew.length, openCount]);

  if (query.isError) return null;
  // Zero friends: the feed's empty state carries the friend finder; a rail of
  // nothing but an add tile would double it.
  if (query.data && query.data.length === 0) return null;

  const goAddFriends = () => router.push({ pathname: "/(tabs)/friends", params: { tab: "Add Friends" } } as Href);

  const onTile = (friend: NotSpottedFriend) => {
    if (stateOf(friend) === "open") {
      trackAnalyticsEvent("taunt_opened", { streak: friend.current_streak > 0 });
      sheet.open(<TauntSheet friend={friend} source="rail" />);
      return;
    }
    router.push(`/user/${friend.username}` as Href);
  };

  return (
    <View style={{ paddingTop: space[2], paddingBottom: space[1] }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingHorizontal: space[4],
          paddingBottom: space[2]
        }}
      >
        <Text variant="micro">
          {everyoneWent ? "Everyone showed up" : allTaunted ? "Their move" : "Not spotted yet"}
        </Text>
        {query.data ? (
          <Text variant="meta">
            {everyoneWent ? "Full house today 🔥" : `${wentCount} of ${crew.length} showed up`}
          </Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[3], paddingHorizontal: space[4], alignItems: "flex-start" }}
      >
        {!query.data ? (
          <>
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </>
        ) : (
          <>
            {tiles.map((friend) => (
              <Tile key={friend.user_id} friend={friend} onPress={() => onTile(friend)} />
            ))}
            {tiles.length === 0 ? (
              // Nothing to draw: every open friend is taunted (or it's rest
              // day all round). Say so instead of leaving a blank strip.
              <View style={{ height: AVATAR + (RING + GAP) * 2, justifyContent: "center", maxWidth: 260 }}>
                <Text variant="body" className="text-white">
                  {crew.length === 0 ? "Rest day all round" : "You've taunted everyone who's not spotted yet"}
                </Text>
                <Text variant="meta">
                  {crew.length === 0
                    ? "Nobody to taunt today."
                    : `${waitingCount} still to post. You get credit when they do.`}
                </Text>
              </View>
            ) : null}
            {query.data.length < THIN_CREW ? <AddTile onPress={goAddFriends} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
