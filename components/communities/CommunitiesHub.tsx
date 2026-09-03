import { useRouter, type Href } from "expo-router";
import { Lock, Plus, Users } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunityDivider, CommunityRow } from "@/components/communities/CommunityRow";
import { CommunityHeroCard } from "@/components/communities/CommunityHeroCard";
import { LockedCommunitySheet } from "@/components/communities/LockedCommunitySheet";
import { Button, RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useSheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useKeyboardHeight } from "@/hooks/useKeyboardVisible";
import {
  useDiscoverCommunities,
  useJoinCommunity,
  useMyCommunities,
  type CommunitySummary
} from "@/hooks/queries/useCommunities";
import { useGymSearch, type GymSearchResult } from "@/hooks/queries/useGymSearch";
import {
  rankBoard,
  useCommunityBoard,
  useCommunityPresence,
  useCrewActivity,
  useHomeGymHub,
  useMarkCommunityRead
} from "@/hooks/queries/useCommunitiesHome";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { tenureBadge } from "@/lib/communityTenure";
import { relDay } from "@/lib/relDay";
import { useAuthStore } from "@/stores/auth";
import { usePresenceStore } from "@/stores/presence";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tabBarClearance } from "@/theme/layout";
import { icon, space, tokens } from "@/theme/tokens";

/** A gym with no community row yet, shaped like one for the tile + preview. */
function gymAsCommunity(gym: GymSearchResult): CommunitySummary {
  return {
    id: gym.id,
    name: gym.name,
    type: "gym",
    gym_id: gym.id,
    gymChain: null,
    gymInstitution: null,
    createdBy: null,
    photoUrl: null,
    description: null,
    privacy: "public",
    location: gym.address,
    memberCount: 0,
    postCount: 0,
    createdAt: null
  };
}

function LabelAction({ label, onPress, icon: glyph }: { label: string; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} haptic="none" accessibilityLabel={label} hitSlop={8}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
        {glyph}
        <Text variant="meta-strong">{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Communities hub (spec v1): an inbox, not a switcher. The gym you're checked
 * in at (else your home gym) is a hero card carrying live signals; every other
 * membership is a row sorted by what's happening; nearby gyms you haven't
 * joined state the lock up front. Content for a community only ever renders
 * on its own screen, behind server-side membership checks.
 */
export function CommunitiesHub({ onEnterCode, onFindGym }: { onEnterCode?: () => void; onFindGym?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const profile = useMyProfile();
  const homeGym = profile.data?.gym ?? null;
  const communities = useMyCommunities();
  const mine = useMemo(() => communities.data ?? [], [communities.data]);
  const atGym = usePresenceStore((s) => s.atGym);
  const activeGymId = usePresenceStore((s) => s.activeGymId);
  const markRead = useMarkCommunityRead();
  const joinPublic = useJoinCommunity();
  const [query, setQuery] = useState("");
  const discover = useDiscoverCommunities(query, homeGym?.id ?? null);
  // Search mode: the sections above the field hide so the field stays put
  // at the top, and results include gyms (locked preview) — most gyms have
  // no community row yet, so a communities-only search found "nothing".
  const searching = query.trim().length > 0;
  // Entering search mode unmounts everything above the field; without this the
  // ScrollView kept its old offset and the (now much shorter) content scrolled
  // off the top, leaving a blank gap under the results.
  useEffect(() => {
    if (searching) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [searching]);
  const gymSearch = useGymSearch(query, null, searching);
  const scrollRef = useRef<ScrollView>(null);
  const [searchY, setSearchY] = useState(0);
  const keyboardHeight = useKeyboardHeight();

  // Hero: where you are right now, else your home gym, else your first gym.
  const hero = useMemo(() => {
    const here = atGym && activeGymId ? mine.find((c) => c.gym_id === activeGymId) : undefined;
    return here ?? mine.find((c) => homeGym && c.gym_id === homeGym.id) ?? mine.find((c) => c.type === "gym") ?? null;
  }, [mine, atGym, activeGymId, homeGym]);
  const heroIsHere = Boolean(hero && atGym && activeGymId && hero.gym_id === activeGymId);

  const crew = useCrewActivity(mine.map((c) => c.id));
  const presence = useCommunityPresence(hero?.id);
  const hub = useHomeGymHub(hero?.gym_id ?? null);
  const userId = useAuthStore((s) => s.userId);
  const board = useCommunityBoard(hero?.id, Boolean(hero && hero.type === "gym"));
  const myRank = useMemo(() => {
    const ranked = rankBoard(board.data?.rows ?? [], "streak");
    return ranked.find((r) => r.row.user_id === userId) ?? null;
  }, [board.data, userId]);

  const others = useMemo(() => {
    const rest = mine.filter((c) => c.id !== hero?.id);
    const at = (id: string) => crew.data?.[id]?.last?.sentAt ?? "";
    return rest.sort((a, b) => {
      const ua = crew.data?.[a.id]?.unread ? 1 : 0;
      const ub = crew.data?.[b.id]?.unread ? 1 : 0;
      if (ua !== ub) return ub - ua;
      const ta = at(a.id);
      const tb = at(b.id);
      if (ta !== tb) return tb.localeCompare(ta);
      return a.name.localeCompare(b.name);
    });
  }, [mine, hero?.id, crew.data]);

  const mineIds = useMemo(() => new Set(mine.map((c) => c.id)), [mine]);
  const nearbyLocked = (discover.data ?? []).filter((c) => c.type === "gym" && !mineIds.has(c.id));
  const morePublic = (discover.data ?? []).filter((c) => (searching || c.type !== "gym") && !mineIds.has(c.id));
  const communityGymIds = new Set((discover.data ?? []).map((c) => c.gym_id).filter(Boolean));
  const gymHits: GymSearchResult[] = searching
    ? (gymSearch.data?.pages[0] ?? []).filter((g) => !communityGymIds.has(g.id)).slice(0, 8)
    : [];

  const open = (community: CommunitySummary, tab?: "Chat" | "Feed" | "Board") => {
    markRead.mutate(community.id);
    router.push(`/community/${community.id}${tab ? `?tab=${tab}` : ""}` as Href);
  };

  const chatLine = (id: string) => {
    const activity = crew.data?.[id];
    if (!activity?.last) return { text: "Quiet — be the one who starts it", quiet: true };
    if (activity.daysQuiet >= 3) return { text: `Quiet since ${relDay(activity.last.sentAt)}`, quiet: true };
    return { text: `${activity.last.senderName.split(" ")[0]}: ${activity.last.preview}`, quiet: false };
  };

  const heroBoard = myRank
    ? {
        label: "Board · streak",
        value: `You're #${myRank.rank}${myRank.row.streak > 0 ? ` · ${myRank.row.streak}-day streak` : " · no streak yet"}`,
        emphasis: true
      }
    : {
        label: "Today",
        value: hub.data && hub.data.checkedInToday > 0 ? `${hub.data.checkedInToday} checked in` : "Nobody yet today",
        emphasis: Boolean(hub.data && hub.data.checkedInToday > 0)
      };

  const lockGlyph = <Lock size={icon.size.xs - 2} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />;

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      contentContainerStyle={{
        paddingBottom: keyboardHeight ? keyboardHeight + space[6] : tabBarClearance(insets.bottom)
      }}
    >
      {searching ? null : (
        <>
          {communities.isLoading ? (
            <SkeletonRows count={4} avatar={44} />
          ) : hero ? (
            <>
              <SectionLabel right={heroIsHere ? <Text variant="meta-strong">Checked in</Text> : undefined}>
                {heroIsHere ? "You're here" : "Your gym"}
              </SectionLabel>
              <CommunityHeroCard
                community={hero}
                tenure={tenureBadge(hero.joinedAt, hero.createdAt)}
                presence={presence.data}
                chatLine={chatLine(hero.id)}
                unread={Boolean(crew.data?.[hero.id]?.unread)}
                boardLabel={heroBoard.label}
                boardValue={heroBoard.value}
                boardEmphasis={heroBoard.emphasis}
                onOpen={() => open(hero)}
                onOpenChat={() => open(hero, "Chat")}
                onOpenBoard={() => open(hero, hero.type === "gym" ? "Board" : "Feed")}
              />
            </>
          ) : (
            <EmptyState
              icon={<Users size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
              title="No gym community yet"
              body="Check in at your gym and you'll be invited to its group — chat, a board that only counts that gym, and everyone who trains there."
              paddingTop={28}
            >
              {onFindGym ? <Button onPress={onFindGym}>Find your gym</Button> : null}
            </EmptyState>
          )}

          {/* Your communities */}
          <SectionLabel
            right={
              <LabelAction
                label="New crew"
                onPress={() => router.push("/community-new" as Href)}
                icon={<Plus size={12} color={colors.silver} strokeWidth={icon.stroke.bold} />}
              />
            }
          >
            Your communities
          </SectionLabel>
          {others.length === 0 ? (
            <Text variant="meta" className="px-4">
              {hero ? "Just this one for now." : "Nothing yet — join your gym's group or start a crew."}
            </Text>
          ) : (
            others.map((community, index) => {
              const line = chatLine(community.id);
              const activity = crew.data?.[community.id];
              return (
                <View key={community.id}>
                  {index > 0 ? <CommunityDivider /> : null}
                  <CommunityRow
                    community={community}
                    state="member"
                    onPress={() => open(community)}
                    accessibilityLabel={`Open ${community.name}`}
                    sub={
                      <Text
                        variant={line.quiet ? "italic" : "meta"}
                        numberOfLines={1}
                        className="mt-[2px] text-[13px] leading-[18px] text-fog"
                      >
                        {line.text}
                      </Text>
                    }
                    right={
                      <View style={{ alignItems: "flex-end", gap: 5 }}>
                        {activity?.last ? <Text variant="micro">{relDay(activity.last.sentAt)}</Text> : null}
                        {activity?.unread ? (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} />
                        ) : null}
                      </View>
                    }
                  />
                </View>
              );
            })
          )}

          {/* Nearby, not joined — the lock is stated before any tap. */}
          {nearbyLocked.length > 0 ? (
            <>
              <SectionLabel>Nearby · not joined</SectionLabel>
              {nearbyLocked.slice(0, 6).map((community, index) => (
                <View key={community.id}>
                  {index > 0 ? <CommunityDivider /> : null}
                  <CommunityRow
                    community={community}
                    state="locked"
                    onPress={() => sheet.open(<LockedCommunitySheet community={community} />)}
                    accessibilityLabel={`Preview ${community.name}`}
                    sub={`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"} · locked · check in to join`}
                    right={
                      <RelButton
                        label="Preview"
                        kind="quiet"
                        onPress={() => sheet.open(<LockedCommunitySheet community={community} />)}
                      />
                    }
                  />
                </View>
              ))}
              <Text variant="meta" className="px-4 pt-3">
                You only ever see a gym&apos;s board, feed, and chat once you&apos;re a member — check in there to join.
                Browsing never unlocks it.
              </Text>
            </>
          ) : null}
        </>
      )}

      {/* More — public crews anyone can join, plus invite codes. */}
      <SectionLabel right={onEnterCode ? <LabelAction label="Have a code?" onPress={onEnterCode} /> : undefined}>
        More communities
      </SectionLabel>
      <View
        style={{ paddingHorizontal: space[4], paddingBottom: space[2] + 2 }}
        onLayout={(e: LayoutChangeEvent) => setSearchY(e.nativeEvent.layout.y)}
      >
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search public communities"
          onFocus={() => {
            // Field to the top of the viewport; the padded bottom leaves room
            // for results between it and the keyboard.
            requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, searchY - 12), animated: true }));
          }}
        />
      </View>
      {searching && gymHits.length > 0 ? (
        <View style={{ paddingBottom: space[1] + 2 }}>
          {gymHits.map((gym) => {
            const asCommunity = gymAsCommunity(gym);
            return (
              <CommunityRow
                key={`gym-${gym.id}`}
                community={asCommunity}
                state="locked"
                onPress={() => sheet.open(<LockedCommunitySheet community={asCommunity} />)}
                accessibilityLabel={`Preview ${gym.name}`}
                sub={gym.address ?? "Gym · check in there to join"}
                right={lockGlyph}
              />
            );
          })}
        </View>
      ) : null}
      {(discover.isLoading || (searching && gymSearch.isLoading)) && morePublic.length === 0 && gymHits.length === 0 ? (
        <SkeletonRows count={3} avatar={34} />
      ) : morePublic.length === 0 ? (
        gymHits.length === 0 ? (
          <Text variant="meta" className="px-4 pb-3">
            {searching ? "No gyms or communities match that name." : "Nothing else to discover yet."}
          </Text>
        ) : null
      ) : (
        morePublic.slice(0, 10).map((community, index) => (
          <View key={community.id}>
            {index > 0 ? <CommunityDivider /> : null}
            <CommunityRow
              community={community}
              onPress={() => router.push(`/community/${community.id}` as Href)}
              accessibilityLabel={`Open ${community.name}`}
              sub={`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"}${community.location ? ` · ${community.location}` : ""}`}
              right={
                <RelButton
                  label="Join"
                  kind="quiet"
                  onPress={() =>
                    joinPublic.mutate(community.id, {
                      onSuccess: () => showToast(`Joined ${community.name}`),
                      onError: () => showToast("Couldn't join — try again")
                    })
                  }
                />
              }
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}
