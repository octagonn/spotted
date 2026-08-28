import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Bell, BellOff, Camera, Check, Globe, Lock, MapPin, MessageSquareOff, Send, Settings, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

import { RoleChip } from "@/components/communities/RoleChip";
import { MessageBubble, TimeSeparator } from "@/components/friends/ChatBubbles";
import { Avatar } from "@/components/ui/Avatar";
import { Button, RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GymLogo } from "@/components/GymLogo";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonChatBubbles, SkeletonGrid, SkeletonHeaderDetail, SkeletonRows } from "@/components/ui/Skeleton";
import {
  NO_PERMISSIONS,
  useCommunity,
  useCommunityJoinRequests,
  useCommunityMembers,
  useCommunityMessages,
  useCommunityMessagesRealtime,
  useCommunityPosts,
  useInviteToCommunity,
  useJoinCommunity,
  useLeaveCommunity,
  useMuteCommunity,
  useMyJoinRequest,
  useRequestToJoin,
  useRespondJoinRequest,
  useSendCommunityMessage
} from "@/hooks/queries/useCommunities";
import { rankBoard, useCommunityBoard, useMarkCommunityRead } from "@/hooks/queries/useCommunitiesHome";
import { Segmented } from "@/components/ui/Segmented";
import { useFriends } from "@/hooks/queries/useFriends";
import { TENURE_LABEL, tenureBadge } from "@/lib/communityTenure";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { relDay } from "@/lib/relDay";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

type CommunityTab = "Chat" | "Board" | "Feed" | "Members";

/** Tenure chip: mono caps, gold for Founding, plain for Day 1. */
function TenureChip({ badge }: { badge: "day1" | "founding" }) {
  const gold = badge === "founding";
  return (
    <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, borderWidth: 1, borderColor: gold ? "rgba(232,180,76,0.35)" : colors.slate, backgroundColor: gold ? "rgba(232,180,76,0.15)" : "transparent" }}>
      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: gold ? colors.gold : colors.silver }}>
        {TENURE_LABEL[badge]}
      </Text>
    </View>
  );
}

/** Sheet: invite friends to the community. Searchable, scrollable, invited state per row. */
function InviteFriendsSheet({ communityId, communityName }: { communityId: string; communityName: string }) {
  const friends = useFriends();
  const invite = useInviteToCommunity(communityId);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (f) => !q || `${f.display_name} ${f.username}`.toLowerCase().includes(q)
  );

  const send = (friendId: string) => {
    invite.mutate(friendId, {
      onSuccess: () => setInvited((prev) => new Set(prev).add(friendId)),
      onError: () => showToast("Couldn't send the invite — try again")
    });
  };

  return (
    <View>
      <SheetTitle>Invite friends</SheetTitle>
      <SheetSub>{`They'll get a notification to join ${communityName}.`}</SheetSub>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      {/* Fixed height (not maxHeight): the dynamic-sizing sheet re-measures
          whenever its content height moves, which is what bounced a dismissed
          sheet back up. A ScrollView inside also makes long lists reachable. */}
      <View style={{ height: 320 }}>
        {friends.isLoading ? (
          <SkeletonRows count={3} />
        ) : rows.length === 0 ? (
          <Text style={{ paddingTop: 28, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            {q ? "No friends match that name." : "No friends yet — add your crew from the Friends tab first."}
          </Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((friend) => (
              <View
                key={friend.id}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 }}
              >
                <Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                    {friend.display_name}
                  </Text>
                  <Text style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>@{friend.username}</Text>
                </View>
                <RelButton
                  label={invited.has(friend.id) ? "Invited ✓" : "Invite"}
                  kind={invited.has(friend.id) ? "quiet" : "primary"}
                  disabled={invited.has(friend.id) || invite.isPending}
                  onPress={() => send(friend.id)}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

export default function CommunityScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const userId = useAuthStore((state) => state.userId);

  const sheet = useSheet();
  const community = useCommunity(id);
  const isMember = community.data?.isMember ?? false;
  // Role permissions (Discord-style): gate chat / posting / inviting /
  // managing per role. RLS enforces the same server-side.
  const perms = community.data?.perms ?? NO_PERMISSIONS;
  const canChat = isMember && perms.view_chat;
  const canSeePosts = !isMember || perms.view_posts;
  const isGym = community.data?.type === "gym";
  const isPrivate = community.data?.privacy === "private";
  const locked = isPrivate && !isMember;

  // Chat is the core surface (spec), so it's the default. "Posts" is the old
  // deep-link name for Feed.
  const [tab, setTab] = useState<CommunityTab>(
    initialTab === "Feed" || initialTab === "Posts" ? "Feed" : initialTab === "Board" || initialTab === "Members" ? initialTab : "Chat"
  );
  const [draft, setDraft] = useState("");

  const posts = useCommunityPosts(id, !locked && canSeePosts);
  const messages = useCommunityMessages(id, canChat);
  useCommunityMessagesRealtime(canChat ? id : undefined);
  const sendMessage = useSendCommunityMessage(id);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const myRequest = useMyJoinRequest(isPrivate && !isMember ? id : undefined);
  const requestToJoin = useRequestToJoin(id);
  const requests = useCommunityJoinRequests(id, perms.manage_members);
  const respond = useRespondJoinRequest(id);
  const markRead = useMarkCommunityRead();
  const mute = useMuteCommunity();
  // Members (with join dates) drive tenure badges in chat + the Members tab.
  const members = useCommunityMembers(id, isMember);
  const board = useCommunityBoard(id, isMember && isGym);
  const [boardMetric, setBoardMetric] = useState("Streak");
  const joinedAtById = useMemo(() => new Map((members.data ?? []).map((m) => [m.user_id, m.joined_at])), [members.data]);

  // Opening the community clears its unread dot on the Communities tab.
  useEffect(() => {
    if (id && isMember) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isMember]);

  // Roles without chat access don't get a Chat tab at all (non-members still
  // see the join prompt there).
  const allTabs: CommunityTab[] = isGym ? ["Chat", "Board", "Feed", "Members"] : ["Chat", "Feed", "Members"];
  const tabs = allTabs.filter((t) => (t !== "Chat" || !isMember || perms.view_chat) && (t !== "Feed" || canSeePosts));
  useEffect(() => {
    if (community.data && !tabs.includes(tab)) setTab(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community.data, tabs.join("|")]);

  // Chat UX (15): when the keyboard opens on the chat tab, keep the latest
  // message in view above the input bar.
  const keyboardVisible = useKeyboardVisible();
  useEffect(() => {
    if (keyboardVisible && tab === "Chat") {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [keyboardVisible, tab]);

  const send = () => {
    const text = draft.trim();
    if (!text || !isMember || !perms.send_messages) return;
    setDraft("");
    sendMessage.mutate(text);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  if (community.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <SkeletonHeaderDetail />
        <SkeletonGrid count={6} />
      </View>
    );
  }
  if (!community.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Community" />
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          This community doesn&apos;t exist anymore.
        </Text>
      </View>
    );
  }

  const info = community.data;
  const Icon = COMMUNITY_ICONS[info.type];

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Community"
        right={
          isMember ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* Mute-per-group (spec): one tap, your pushes only. */}
              <Pressable
                onPress={() => mute.mutate({ communityId: info.id, muted: !info.muted }, { onSuccess: () => showToast(info.muted ? "Unmuted" : "Muted") })}
                accessibilityLabel={info.muted ? "Unmute this community" : "Mute this community"}
                accessibilityState={{ selected: info.muted }}
                hitSlop={8}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: info.muted ? colors.slate : colors.iron, backgroundColor: info.muted ? colors.charcoal : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {info.muted ? <BellOff size={17} color={colors.mist} strokeWidth={2} /> : <Bell size={17} color={colors.mist} strokeWidth={2} />}
                </View>
              </Pressable>
              {/* Post directly to this community (16) — existing camera flow with
                  this community pre-selected; gym rules still apply there.
                  Hidden for roles without the post permission. */}
              {perms.post ? (
                <Pressable onPress={() => router.push(`/camera?mode=daily&community=${info.id}` as Href)} accessibilityLabel="Post to this community" hitSlop={8}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                    <Camera size={17} color={colors.mist} strokeWidth={2} />
                  </View>
                </Pressable>
              ) : null}
              {/* Settings — all members (18); admin-only sections gate inside. */}
              <Pressable onPress={() => router.push(`/community/${info.id}/settings` as Href)} accessibilityLabel="Community settings" hitSlop={8}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                  <Settings size={17} color={colors.mist} strokeWidth={2} />
                </View>
              </Pressable>
            </View>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      >
        {/* Header: photo + name + meta */}
        <View style={{ paddingHorizontal: 18, paddingTop: 6, flexDirection: "row", gap: 14 }}>
          {/* Gym communities without a custom photo show the chain logo (one per chain). */}
          <GymLogo
            gym={info.photoUrl ? {} : { chain: info.gymChain, institution: info.gymInstitution, name: isGym ? info.name : null }}
            size={68}
            radius={18}
            fallback={
              <View style={{ width: 68, height: 68, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.iron, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" }}>
                {info.photoUrl ? (
                  <Image source={{ uri: info.photoUrl }} contentFit="cover" style={{ width: 68, height: 68 }} />
                ) : (
                  <Icon size={26} color={colors.mist} />
                )}
              </View>
            }
          />
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ fontFamily: "Boldonse_400Regular", fontSize: 17, lineHeight: 26, color: colors.white }} numberOfLines={2}>
              {info.name}
            </Text>
            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
              {/* Tappable — the full member list lives one tap away. */}
              <Pressable
                onPress={() => router.push(`/community/${id}/members` as Href)}
                accessibilityLabel="See all members"
                hitSlop={6}
              >
                <Text style={{ fontSize: 12, fontFamily: "Geist_600SemiBold", color: colors.mist, textDecorationLine: "underline" }}>
                  {`${info.memberCount} member${info.memberCount === 1 ? "" : "s"}`}
                </Text>
              </Pressable>
              <Text style={{ fontSize: 12, color: colors.iron }}>·</Text>
              {isPrivate ? <Lock size={11} color={colors.fog} strokeWidth={2} /> : <Globe size={11} color={colors.fog} strokeWidth={2} />}
              <Text style={{ fontSize: 12, color: colors.fog }}>{isPrivate ? "Private" : "Public"}</Text>
              {info.location ? (
                <>
                  <Text style={{ fontSize: 12, color: colors.iron }}>·</Text>
                  <MapPin size={11} color={colors.fog} strokeWidth={2} />
                  <Text style={{ fontSize: 12, color: colors.fog }} numberOfLines={1}>{info.location}</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {info.description ? (
          <Text style={{ paddingHorizontal: 18, paddingTop: 10, fontSize: 13, lineHeight: 18, color: colors.mist }}>
            {info.description}
          </Text>
        ) : null}
        {isGym ? (
          <Text style={{ paddingHorizontal: 18, paddingTop: 6, fontSize: 11.5, color: colors.fog }}>
            Posts require being at this gym.
          </Text>
        ) : null}

        {/* Join / Request / Leave / Invite */}
        <View style={{ marginTop: 12, paddingHorizontal: 18, flexDirection: "row", gap: 10, alignSelf: "flex-start" }}>
          {isMember ? (
            perms.invite ? (
              <Button
                variant="ghost"
                onPress={() => sheet.open(<InviteFriendsSheet communityId={info.id} communityName={info.name} />)}
              >
                Invite friends
              </Button>
            ) : null
          ) : isPrivate ? (
            myRequest.data ? (
              <Button variant="ghost" disabled>
                Requested
              </Button>
            ) : (
              <Button onPress={() => requestToJoin.mutate(undefined, { onSuccess: () => showToast("Request sent") })} loading={requestToJoin.isPending}>
                Request to join
              </Button>
            )
          ) : (
            <Button onPress={() => join.mutate(info.id, { onSuccess: () => showToast(`Joined ${info.name}`) })} loading={join.isPending}>
              Join community
            </Button>
          )}
        </View>

        {/* Managers: pending join requests */}
        {perms.manage_members && (requests.data ?? []).length > 0 ? (
          <View style={{ marginTop: 16, marginHorizontal: 18, borderWidth: 1, borderColor: colors.iron, borderRadius: 16, backgroundColor: colors.graphite, overflow: "hidden" }}>
            <Text style={{ padding: 14, paddingBottom: 8, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, textTransform: "uppercase", color: colors.fog }}>
              {`Pending requests · ${(requests.data ?? []).length}`}
            </Text>
            {(requests.data ?? []).map((req) => (
              <View key={req.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 12 }}>
                <Pressable onPress={() => req.profile && router.push(`/user/${req.profile.username}` as Href)}>
                  <Avatar name={req.profile?.display_name ?? "?"} uri={req.profile?.avatar_url} size={38} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.white }} numberOfLines={1}>
                    {req.profile?.display_name ?? "Someone"}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.fog }} numberOfLines={1}>@{req.profile?.username ?? "user"}</Text>
                </View>
                <Pressable onPress={() => respond.mutate({ userId: req.user_id, accept: true })} accessibilityLabel="Approve">
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
                    <Check size={16} color={colors.black} strokeWidth={2.6} />
                  </View>
                </Pressable>
                <Pressable onPress={() => respond.mutate({ userId: req.user_id, accept: false })} accessibilityLabel="Deny">
                  <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                    <X size={16} color={colors.fog} strokeWidth={2.4} />
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Locked (private, non-member): hide all content */}
        {locked ? (
          <EmptyState
            icon={<Lock size={22} color={colors.silver} strokeWidth={2} />}
            title="This community is private"
            body="Request to join to see posts, chat, and rankings. An admin has to approve you."
          />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 22, marginTop: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
              {tabs.map((item) => (
                <Pressable key={item} onPress={() => setTab(item)} accessibilityRole="tab" accessibilityState={{ selected: tab === item }}>
                  <View style={{ paddingBottom: 10, borderBottomWidth: tab === item ? 2 : 0, borderBottomColor: colors.white }}>
                    <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: tab === item ? colors.white : colors.fog }}>
                      {item}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {tab === "Feed" ? (
              (posts.data ?? []).length === 0 ? (
                posts.isLoading ? (
                  <SkeletonGrid count={6} />
                ) : (
                  <Text style={{ paddingTop: 32, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                    {perms.post ? "No posts yet. Share a daily to this community from the camera." : "No posts yet."}
                  </Text>
                )
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingTop: 2 }}>
                  {(posts.data ?? []).map((post) => (
                    <Pressable
                      key={post.id}
                      onPress={() => (post.user_id === userId ? router.push("/(tabs)/profile") : router.push(`/user/${post.username}`))}
                      accessibilityLabel={`Community post by @${post.username}`}
                      style={{ width: "33%" }}
                    >
                      <View style={{ aspectRatio: 3 / 4, backgroundColor: colors.graphite }}>
                        {post.media_url ? <Image source={{ uri: post.media_url }} contentFit="cover" style={{ flex: 1 }} /> : null}
                        <View style={{ position: "absolute", left: 6, bottom: 6, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 3, paddingHorizontal: 7 }}>
                          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 9.5, color: colors.white }}>@{post.username}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : null}

            {tab === "Chat" ? (
              !isMember ? (
                <View style={{ alignItems: "center", paddingTop: 32, paddingHorizontal: 32, gap: 12 }}>
                  <Text style={{ textAlign: "center", fontSize: 13, color: colors.fog }}>
                    Join the community to see and send messages.
                  </Text>
                  <RelButton label="Join" kind="primary" onPress={() => join.mutate(info.id, { onSuccess: () => showToast(`Joined ${info.name}`) })} />
                </View>
              ) : (
                // Messages only — the input bar is pinned at the bottom of the
                // screen (outside this ScrollView), like a standard chat UI (15).
                <View style={{ minHeight: 280, gap: 4, paddingHorizontal: 16, paddingTop: 8 }}>
                  {(messages.data ?? []).length === 0 ? (
                    messages.isLoading ? (
                      <SkeletonChatBubbles />
                    ) : (
                      <Text style={{ paddingTop: 32, textAlign: "center", fontSize: 12, color: colors.fog }}>
                        No messages yet. Say something.
                      </Text>
                    )
                  ) : (
                    <>
                      <TimeSeparator label="Chat" />
                      {(messages.data ?? []).map((message, index, list) => {
                        if (message.kind === "system") {
                          // Announcement (e.g. "💎 Ethan just hit Diamond") — centered, no bubble.
                          return (
                            <View key={message.id} style={{ alignItems: "center", paddingVertical: 10, paddingHorizontal: 24 }}>
                              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, lineHeight: 18, color: "#C9F3FF", textAlign: "center" }}>
                                {message.content}
                              </Text>
                            </View>
                          );
                        }
                        const mine = message.sender_id === userId;
                        // Show identity on the first message of each sender run.
                        const firstOfRun = index === 0 || list[index - 1].sender_id !== message.sender_id;
                        const senderName = message.sender?.display_name ?? message.sender?.username ?? "Member";
                        const openSender = () => {
                          if (!message.sender?.username) return;
                          router.push(`/user/${message.sender.username}` as Href);
                        };
                        return (
                          <View key={message.id} style={{ marginTop: firstOfRun && index > 0 ? 10 : 0 }}>
                            {!mine && firstOfRun ? (
                              /* Who's talking — avatar + name, both open the profile. */
                              <Pressable onPress={openSender} accessibilityLabel={`Open ${senderName}'s profile`}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 2, paddingBottom: 4 }}>
                                  <Avatar name={senderName} uri={message.sender?.avatar_url ?? null} size={28} />
                                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.bone }}>
                                    {senderName}
                                  </Text>
                                  {(() => {
                                    const badge = tenureBadge(joinedAtById.get(message.sender_id), info.createdAt);
                                    return badge ? <TenureChip badge={badge} /> : null;
                                  })()}
                                </View>
                              </Pressable>
                            ) : null}
                            <View style={{ paddingLeft: mine ? 0 : 36 }}>
                              <MessageBubble mine={mine} text={message.content} />
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              )
            ) : null}

            {tab === "Board" ? (
              !isMember ? (
                <Text style={{ paddingTop: 32, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                  Join the community to see its board.
                </Text>
              ) : board.isLoading ? (
                <SkeletonRows count={5} avatar={32} />
              ) : (
                (() => {
                  const metric = boardMetric === "Streak" ? "streak" : "month_days";
                  const ranked = rankBoard(board.data?.rows ?? [], metric);
                  const mine = ranked.find((r) => r.row.user_id === userId);
                  const unit = metric === "streak" ? "days" : "check-ins";
                  const renderRow = ({ row, rank }: (typeof ranked)[number], pinned = false) => {
                    const me = row.user_id === userId;
                    const badge = tenureBadge(row.joined_at, info.createdAt);
                    return (
                      <View
                        key={`${pinned ? "me-" : ""}${row.user_id}`}
                        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.iron, backgroundColor: me ? "rgba(232,180,76,0.15)" : "transparent" }}
                      >
                        <Text style={{ width: 22, textAlign: "right", fontFamily: "GeistMono_400Regular", fontSize: 12, color: rank <= 3 || me ? colors.gold : colors.fog }}>{rank}</Text>
                        <Avatar name={row.name} uri={row.avatar_url} size={32} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                              {me ? "You" : row.name}
                            </Text>
                            {badge ? <TenureChip badge={badge} /> : null}
                          </View>
                          {row.last_day && metric === "streak" && row.streak > 0 ? (
                            <Text style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>{`last check-in ${relDay(row.last_day)}`}</Text>
                          ) : null}
                        </View>
                        <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 14, color: colors.white }}>
                          {row[metric]}
                          <Text style={{ fontSize: 10.5, letterSpacing: 0.6, color: colors.fog }}>{`  ${unit.toUpperCase()}`}</Text>
                        </Text>
                      </View>
                    );
                  };
                  const top = ranked.slice(0, 25);
                  const mineInTop = mine ? top.some((r) => r.row.user_id === userId) : true;
                  return (
                    <View style={{ paddingTop: 10 }}>
                      <Segmented options={["Streak", "This month"]} value={boardMetric} onChange={setBoardMetric} style={{ marginTop: 0 }} />
                      <Text style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 8, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase", color: colors.fog }}>
                        {metric === "streak" ? "Gym days in a row · this gym only" : "Check-in days this month · this gym only"}
                      </Text>
                      {ranked.length === 0 ? (
                        <Text style={{ paddingTop: 24, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                          No check-ins here yet. First one on the board wins.
                        </Text>
                      ) : (
                        <View style={{ marginHorizontal: 18, borderWidth: 1, borderColor: colors.iron, borderRadius: 16, backgroundColor: colors.graphite, overflow: "hidden" }}>
                          {top.map((r) => renderRow(r))}
                          {mine && !mineInTop ? (
                            <>
                              <View style={{ height: 6, backgroundColor: colors.black }} />
                              {renderRow(mine, true)}
                            </>
                          ) : null}
                        </View>
                      )}
                      <Text style={{ paddingHorizontal: 18, paddingTop: 10, fontSize: 11.5, lineHeight: 16, color: colors.fog }}>
                        Streaks and check-ins here count only days at this gym. Your profile streak is unchanged.
                      </Text>
                    </View>
                  );
                })()
              )
            ) : null}

            {tab === "Members" ? (
              members.isLoading ? (
                <SkeletonRows count={5} avatar={44} />
              ) : (
                <View style={{ paddingTop: 4 }}>
                  {(members.data ?? []).map((member) => {
                    const name = member.profile?.display_name ?? "Member";
                    const badge = tenureBadge(member.joined_at, info.createdAt);
                    const me = member.user_id === userId;
                    return (
                      <Pressable
                        key={member.user_id}
                        onPress={() => (me ? router.push("/(tabs)/profile" as Href) : member.profile && router.push(`/user/${member.profile.username}` as Href))}
                        accessibilityLabel={`Open ${name}'s profile`}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 18 }}>
                          <Avatar name={name} uri={member.profile?.avatar_url ?? null} size={44} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>
                                {name}
                                {me ? <Text style={{ color: colors.fog }}>  (you)</Text> : null}
                              </Text>
                              {badge ? <TenureChip badge={badge} /> : null}
                            </View>
                            <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>
                              @{member.profile?.username ?? "unknown"} · joined {relDay(member.joined_at)}
                            </Text>
                          </View>
                          <RoleChip role={member.roleInfo} legacyRole={member.role} />
                        </View>
                      </Pressable>
                    );
                  })}
                  {isMember ? (
                    // Spec: leave from the member list, one tap, no confirm.
                    // Chat + board access end immediately; history is untouched.
                    <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
                      <Button
                        variant="ghost"
                        onPress={() => leave.mutate(info.id, { onSuccess: () => showToast(`Left ${info.name}`) })}
                        loading={leave.isPending}
                      >
                        Leave this community
                      </Button>
                    </View>
                  ) : null}
                </View>
              )
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Read-only chat for roles without send permission. */}
      {tab === "Chat" && canChat && !locked && !perms.send_messages ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 6, marginBottom: insets.bottom + 10, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.iron, backgroundColor: colors.graphite }}>
          <MessageSquareOff size={15} color={colors.fog} strokeWidth={2} />
          <Text style={{ fontFamily: "Geist_500Medium", fontSize: 12.5, color: colors.fog }}>
            {perms.role_name ? `${perms.role_name} can read but not send here` : "Chat is read-only for your role"}
          </Text>
        </View>
      ) : null}

      {/* Pinned chat input — bottom of the screen, rises with the keyboard (15). */}
      {tab === "Chat" && canChat && !locked && perms.send_messages ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginHorizontal: 16,
            marginTop: 6,
            marginBottom: keyboardVisible ? 8 : insets.bottom + 10,
            borderWidth: 1,
            borderColor: colors.iron,
            borderRadius: 999,
            backgroundColor: colors.graphite,
            paddingLeft: 16,
            paddingRight: 5,
            paddingVertical: 5
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the community…"
            placeholderTextColor={colors.fog}
            returnKeyType="send"
            onSubmitEditing={send}
            style={{ flex: 1, paddingVertical: 7, fontSize: 14, color: colors.bone }}
          />
          <Pressable onPress={send} disabled={!draft.trim() || sendMessage.isPending} accessibilityLabel="Send message">
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: draft.trim() ? colors.white : colors.iron }}>
              <Send size={16} color={draft.trim() ? colors.black : colors.fog} />
            </View>
          </Pressable>
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
