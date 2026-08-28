import { useMemo, useRef, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { Check, Dumbbell, Lock, Plus, Users } from "lucide-react-native";
import { Platform, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { CachedImage } from "@/components/ui/CachedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useKeyboardHeight } from "@/hooks/useKeyboardVisible";
import { useDiscoverCommunities, useJoinCommunity, useMyCommunities, type CommunitySummary } from "@/hooks/queries/useCommunities";
import { useGymSearch, type GymSearchResult } from "@/hooks/queries/useGymSearch";
import { rankBoard, useCommunityBoard, useCommunityPresence, useCrewActivity, useHomeGymHub, useMarkCommunityRead } from "@/hooks/queries/useCommunitiesHome";
import { useAuthStore } from "@/stores/auth";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { TENURE_LABEL, tenureBadge } from "@/lib/communityTenure";
import { relDay } from "@/lib/relDay";
import { usePresenceStore } from "@/stores/presence";
import { showToast } from "@/stores/ui";
import { gymLogo, gymLogoIsFullBleed } from "@/lib/gymChains";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const NAV_H = 84;
/** State color only (member / here-now) — gold stays the app's one accent. */
const OK = "#5BBF7A";
const OK_SOFT = "rgba(91,191,122,0.14)";

function Label({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, textTransform: "uppercase", color: colors.fog }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "ok" | "gold" }) {
  const color = tone === "ok" ? OK : tone === "gold" ? tokens.accent.gold : colors.silver;
  const border = tone === "ok" ? "rgba(91,191,122,0.35)" : tone === "gold" ? "rgba(232,180,76,0.35)" : colors.slate;
  const bg = tone === "ok" ? OK_SOFT : tone === "gold" ? tokens.accent.goldSubtle : "transparent";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: border, backgroundColor: bg }}>
      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", color }}>{children}</Text>
    </View>
  );
}

function Tile({ community, size = 48, locked = false }: { community: CommunitySummary; size?: number; locked?: boolean }) {
  const Icon = COMMUNITY_ICONS[community.type];
  // Gym communities: the chain logo (one bundled image per chain) unless a
  // custom photo was set. Locked previews still show it — it's public brand art.
  const gymRef = { chain: community.gymChain, institution: community.gymInstitution, name: community.name };
  const logo = community.type === "gym" && !community.photoUrl ? gymLogo(gymRef) : null;
  if (logo) {
    const fullBleed = gymLogoIsFullBleed(gymRef);
    return (
      <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: fullBleed ? tokens.bg.subtle : "#FFFFFF", overflow: "hidden", alignItems: "center", justifyContent: "center", opacity: locked ? 0.8 : 1 }}>
        <CachedImage
          source={logo}
          contentFit={fullBleed ? "cover" : "contain"}
          style={fullBleed ? { width: size, height: size } : { width: size * 0.68, height: size * 0.68 }}
        />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: tokens.bg.subtle, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {locked ? (
        <Lock size={size * 0.36} color={colors.fog} strokeWidth={2} />
      ) : community.photoUrl ? (
        <CachedImage source={{ uri: community.photoUrl }} contentFit="cover" style={{ width: size, height: size }} />
      ) : community.type === "gym" ? (
        <Dumbbell size={size * 0.42} color={colors.mist} strokeWidth={2} />
      ) : (
        <Icon size={size * 0.42} color={colors.mist} />
      )}
    </View>
  );
}

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

/** Locked preview: name, member count, thumbnail — and nothing real, ever. */
function LockedCommunitySheet({ community }: { community: CommunitySummary }) {
  const sheet = useSheet();
  return (
    <View style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 }}>
        <Tile community={community} size={48} locked />
        <View style={{ flex: 1, minWidth: 0 }}>
          <SheetTitle>{community.name}</SheetTitle>
          <Text style={{ marginTop: -6, paddingHorizontal: 20, fontSize: 13, color: colors.fog }}>
            {`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"}`}
          </Text>
        </View>
      </View>
      <View style={{ marginHorizontal: 20, marginTop: 16, paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1, borderStyle: "dashed", borderColor: colors.slate, alignItems: "center" }}>
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase", color: colors.fog }}>
          Board · feed · chat — members only
        </Text>
      </View>
      <View style={{ marginHorizontal: 20, marginTop: 12, flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: tokens.border.default }}>
        <Lock size={16} color={colors.fog} strokeWidth={1.9} style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.silver }}>
          You&apos;ll only ever see a gym&apos;s board, feed, and chat once you&apos;re a member —{" "}
          <Text style={{ color: colors.white, fontFamily: "Geist_600SemiBold" }}>check in there to join.</Text> Browsing never unlocks it.
        </Text>
      </View>
      <Pressable onPress={() => sheet.close()} accessibilityLabel="Got it" style={{ marginHorizontal: 20, marginTop: 16 }}>
        <View style={{ height: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>Got it</Text>
        </View>
      </Pressable>
    </View>
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

  const heroTenure = hero ? tenureBadge(hero.joinedAt, hero.createdAt) : null;
  const heroLine = hero ? chatLine(hero.id) : null;
  const heroUnread = hero ? Boolean(crew.data?.[hero.id]?.unread) : false;
  const here = presence.data;

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      contentContainerStyle={{ paddingBottom: NAV_H + insets.bottom + 12 + (keyboardHeight ? keyboardHeight + 240 : 0) }}
    >
      {searching ? null : (
        <>
      {communities.isLoading ? (
        <SkeletonRows count={4} avatar={44} />
      ) : hero ? (
        <>
          <Label right={heroIsHere ? <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.silver }}>Checked in</Text> : undefined}>
            {heroIsHere ? "You're here" : "Your gym"}
          </Label>
          <View style={{ marginHorizontal: 18, backgroundColor: tokens.bg.raised, borderWidth: 1, borderColor: tokens.border.default, borderRadius: radius.md, overflow: "hidden" }}>
            <Pressable onPress={() => open(hero)} accessibilityLabel={`Open ${hero.name}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 0 }}>
                <Tile community={hero} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 16, letterSpacing: -0.2, color: colors.white }}>
                    {hero.name}
                  </Text>
                  <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Chip tone="ok">✓ Member</Chip>
                    {heroTenure ? <Chip tone="gold">{TENURE_LABEL[heroTenure]}</Chip> : null}
                    <Text style={{ fontSize: 12.5, color: colors.fog }}>{`${hero.memberCount} ${hero.memberCount === 1 ? "member" : "members"}`}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
            {/* Presence — rendered only when someone is actually there (no fake activity). */}
            {here && here.count > 0 ? (
              <View style={{ margin: 14, marginBottom: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.hairline }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OK }} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.bone }} numberOfLines={2}>
                  <Text style={{ fontFamily: "Geist_600SemiBold", color: colors.white }}>
                    {here.people.map((p) => p.name.split(" ")[0]).join(", ")}
                  </Text>
                  {here.count > here.people.length ? ` and ${here.count - here.people.length} more` : ""}
                  {here.count === 1 ? " is here now" : " are here now"}
                </Text>
                <View style={{ flexDirection: "row" }}>
                  {here.people.map((p, i) => (
                    <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                      <Avatar name={p.name} uri={p.avatar_url} size={26} borderColor={tokens.bg.raised} borderWidth={2} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {/* Signals */}
            <View style={{ marginTop: 14, flexDirection: "row", borderTopWidth: 1, borderTopColor: tokens.border.default }}>
              <Pressable onPress={() => open(hero, "Chat")} style={{ flex: 1, padding: 12, paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: tokens.border.default }} accessibilityLabel="Latest chat">
                <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 1.1, textTransform: "uppercase", color: colors.fog }}>Chat</Text>
                <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 13.5, fontFamily: heroLine?.quiet ? "Geist_400Regular" : "Geist_600SemiBold", color: heroLine?.quiet ? colors.fog : colors.white }}>
                  {heroLine?.text}
                </Text>
              </Pressable>
              <Pressable onPress={() => open(hero, "Board")} style={{ flex: 1, padding: 12, paddingHorizontal: 14 }} accessibilityLabel="Board">
                <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 1.1, textTransform: "uppercase", color: colors.fog }}>
                  {myRank ? "Board · streak" : "Today"}
                </Text>
                {myRank ? (
                  <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 13.5, fontFamily: "Geist_600SemiBold", color: colors.white }}>
                    You&apos;re <Text style={{ color: tokens.accent.gold }}>#{myRank.rank}</Text>
                    <Text style={{ color: colors.fog, fontFamily: "Geist_400Regular" }}>
                      {myRank.row.streak > 0 ? ` · ${myRank.row.streak}-day streak` : " · no streak yet"}
                    </Text>
                  </Text>
                ) : (
                  <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 13.5, fontFamily: "Geist_600SemiBold", color: hub.data && hub.data.checkedInToday > 0 ? colors.white : colors.fog }}>
                    {hub.data && hub.data.checkedInToday > 0 ? `${hub.data.checkedInToday} checked in` : "Nobody yet today"}
                  </Text>
                )}
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8, padding: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
              <Pressable onPress={() => open(hero, "Chat")} accessibilityLabel="Open chat" style={{ flex: 1 }}>
                <View style={{ height: 40, borderRadius: radius.sm, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: colors.black }}>Open chat</Text>
                  {heroUnread ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.18)" }}>
                      <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 10, color: colors.black }}>NEW</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
              <Pressable onPress={() => open(hero, hero.type === "gym" ? "Board" : "Feed")} accessibilityLabel={hero.type === "gym" ? "Open board" : "Open feed"} style={{ flex: 1 }}>
                <View style={{ height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: colors.white }}>{hero.type === "gym" ? "Board" : "Feed"}</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <EmptyState
          icon={<Users size={22} color={colors.silver} strokeWidth={2} />}
          title="No gym community yet"
          body="Check in at your gym and you'll be invited to its group — chat, a board that only counts that gym, and everyone who trains there."
          paddingTop={28}
        >
          {onFindGym ? (
            <Pressable onPress={onFindGym} accessibilityLabel="Find your gym">
              <View style={{ height: 44, borderRadius: radius.sm, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Find your gym</Text>
              </View>
            </Pressable>
          ) : null}
        </EmptyState>
      )}

      {/* Your communities */}
      <Label
        right={
          <Pressable onPress={() => router.push("/community-new" as Href)} accessibilityLabel="Start a crew" hitSlop={8}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Plus size={12} color={colors.silver} strokeWidth={2.4} />
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.silver }}>New crew</Text>
            </View>
          </Pressable>
        }
      >
        Your communities
      </Label>
      {others.length === 0 ? (
        <Text style={{ paddingHorizontal: 18, fontSize: 12.5, color: colors.fog }}>
          {hero ? "Just this one for now." : "Nothing yet — join your gym's group or start a crew."}
        </Text>
      ) : (
        others.map((community, index) => {
          const line = chatLine(community.id);
          const activity = crew.data?.[community.id];
          return (
            <View key={community.id}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: tokens.border.default, marginHorizontal: 18 }} /> : null}
              <Pressable onPress={() => open(community)} accessibilityLabel={`Open ${community.name}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 18 }}>
                  <Tile community={community} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>
                        {community.name}
                      </Text>
                      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(91,191,122,0.35)", backgroundColor: OK_SOFT, alignItems: "center", justifyContent: "center" }}>
                        <Check size={9} color={OK} strokeWidth={3} />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: colors.fog, fontStyle: line.quiet ? "italic" : "normal" }}>
                      {line.text}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    {activity?.last ? (
                      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>{relDay(activity.last.sentAt)}</Text>
                    ) : null}
                    {activity?.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} /> : null}
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })
      )}

      {/* Nearby, not joined — the lock is stated before any tap. */}
      {nearbyLocked.length > 0 ? (
        <>
          <Label>Nearby · not joined</Label>
          {nearbyLocked.slice(0, 6).map((community, index) => (
            <View key={community.id}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: tokens.border.default, marginHorizontal: 18 }} /> : null}
              <Pressable onPress={() => sheet.open(<LockedCommunitySheet community={community} />)} accessibilityLabel={`Preview ${community.name}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 18 }}>
                  <Tile community={community} size={44} locked />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{community.name}</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                      {`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"} · `}
                      <Text style={{ color: colors.silver }}>Board &amp; feed locked</Text>
                      {" · check in to join"}
                    </Text>
                  </View>
                  <View style={{ height: 30, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.white }}>Preview</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
          <View style={{ marginHorizontal: 18, marginTop: 12, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: tokens.border.default }}>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.fog }}>
              You only ever see a gym&apos;s board, feed, and chat once you&apos;re a member —{" "}
              <Text style={{ color: colors.silver, fontFamily: "Geist_500Medium" }}>check in there to join.</Text> Browsing never unlocks it.
            </Text>
          </View>
        </>
      ) : null}
        </>
      )}

      {/* More — public crews anyone can join, plus invite codes. */}
      <Label
        right={
          onEnterCode ? (
            <Pressable onPress={onEnterCode} accessibilityLabel="Enter invite code" hitSlop={8}>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.silver }}>Have a code?</Text>
            </Pressable>
          ) : undefined
        }
      >
        More communities
      </Label>
      <View
        style={{ paddingHorizontal: 18, paddingBottom: 10 }}
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
        <View style={{ paddingBottom: 6 }}>
          {gymHits.map((gym) => {
            const asCommunity = gymAsCommunity(gym);
            return (
              <Pressable
                key={`gym-${gym.id}`}
                onPress={() => sheet.open(<LockedCommunitySheet community={asCommunity} />)}
                accessibilityLabel={`Preview ${gym.name}`}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 18 }}>
                  <Tile community={asCommunity} size={44} locked />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{gym.name}</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                      {gym.address ?? "Gym · check in there to join"}
                    </Text>
                  </View>
                  <Lock size={14} color={colors.fog} strokeWidth={2} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {(discover.isLoading || (searching && gymSearch.isLoading)) && morePublic.length === 0 && gymHits.length === 0 ? (
        <SkeletonRows count={3} avatar={34} />
      ) : morePublic.length === 0 ? (
        gymHits.length === 0 ? (
          <Text style={{ paddingHorizontal: 18, paddingBottom: 12, fontSize: 12.5, color: colors.fog }}>
            {searching ? "No gyms or communities match that name." : "Nothing else to discover yet."}
          </Text>
        ) : null
      ) : (
        morePublic.slice(0, 10).map((community, index) => (
          <View key={community.id}>
            {index > 0 ? <View style={{ height: 1, backgroundColor: tokens.border.default, marginHorizontal: 18 }} /> : null}
            <Pressable onPress={() => router.push(`/community/${community.id}` as Href)} accessibilityLabel={`Open ${community.name}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 18 }}>
                <Tile community={community} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{community.name}</Text>
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
                    {`${community.memberCount} ${community.memberCount === 1 ? "member" : "members"}`}
                    {community.location ? ` · ${community.location}` : ""}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Join ${community.name}`}
                  onPress={() =>
                    joinPublic.mutate(community.id, {
                      onSuccess: () => showToast(`Joined ${community.name}`),
                      onError: () => showToast("Couldn't join — try again")
                    })
                  }
                >
                  <View style={{ height: 30, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.white }}>Join</Text>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}
