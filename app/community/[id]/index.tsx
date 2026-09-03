import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Bell, BellOff, Camera, Lock, MessageSquareOff, Settings } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatComposer } from "@/components/chat/ChatComposer";
import { CommunityBoard } from "@/components/communities/CommunityBoard";
import { CommunityChatList } from "@/components/communities/CommunityChatList";
import { CommunityFeedGrid } from "@/components/communities/CommunityFeedGrid";
import { CommunityHeader } from "@/components/communities/CommunityHeader";
import { InviteFriendsSheet } from "@/components/communities/InviteFriendsSheet";
import { JoinRequestRow, MemberRow } from "@/components/communities/MemberRow";
import { Button, RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useSheet } from "@/components/ui/Sheet";
import { SkeletonGrid, SkeletonHeaderDetail, SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import {
  NO_PERMISSIONS,
  useCommunity,
  useCommunityJoinRequests,
  useCommunityMembers,
  useCommunityMessages,
  useCommunityMessagesRealtime,
  useCommunityPosts,
  useJoinCommunity,
  useLeaveCommunity,
  useMuteCommunity,
  useMyJoinRequest,
  useRequestToJoin,
  useRespondJoinRequest,
  useSendCommunityMessage
} from "@/hooks/queries/useCommunities";
import { useCommunityBoard, useMarkCommunityRead } from "@/hooks/queries/useCommunitiesHome";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

type CommunityTab = "Chat" | "Board" | "Feed" | "Members";

/** Underline tab row for the community sections (3–4 tabs, content-width). */
function TabRow({
  tabs,
  value,
  onChange
}: {
  tabs: CommunityTab[];
  value: CommunityTab;
  onChange: (t: CommunityTab) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space[6] - 2,
        marginTop: space[4],
        paddingHorizontal: space[4],
        borderBottomWidth: 1,
        borderBottomColor: colors.graphite
      }}
    >
      {tabs.map((item) => {
        const selected = value === item;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <View
              style={{
                paddingBottom: space[2] + 2,
                borderBottomWidth: selected ? 2 : 0,
                borderBottomColor: colors.white
              }}
            >
              <Text variant="meta-strong" className={selected ? "text-white" : "text-fog"}>
                {item}
              </Text>
            </View>
          </Pressable>
        );
      })}
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
    initialTab === "Feed" || initialTab === "Posts"
      ? "Feed"
      : initialTab === "Board" || initialTab === "Members"
        ? initialTab
        : "Chat"
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
  const joinedAtById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.user_id, m.joined_at])),
    [members.data]
  );

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

  const joinNow = () => {
    if (!community.data) return;
    const name = community.data.name;
    join.mutate(community.data.id, { onSuccess: () => showToast(`Joined ${name}`) });
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
        <Text variant="meta" className="pt-10 text-center">
          This community doesn&apos;t exist anymore.
        </Text>
      </View>
    );
  }

  const info = community.data;
  const iconColor = tokens.text.secondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Community"
        right={
          isMember ? (
            <View style={{ flexDirection: "row", gap: space[1] }}>
              {/* Mute-per-group (spec): one tap, your pushes only. */}
              <IconButton
                variant="plain"
                icon={
                  info.muted ? (
                    <BellOff size={icon.size.sm} color={iconColor} strokeWidth={icon.stroke.regular} />
                  ) : (
                    <Bell size={icon.size.sm} color={iconColor} strokeWidth={icon.stroke.regular} />
                  )
                }
                accessibilityLabel={info.muted ? "Unmute this community" : "Mute this community"}
                haptic="selection"
                onPress={() =>
                  mute.mutate(
                    { communityId: info.id, muted: !info.muted },
                    { onSuccess: () => showToast(info.muted ? "Unmuted" : "Muted") }
                  )
                }
              />
              {/* Post directly to this community (16) — existing camera flow with
                  this community pre-selected; gym rules still apply there.
                  Hidden for roles without the post permission. */}
              {perms.post ? (
                <IconButton
                  variant="plain"
                  icon={<Camera size={icon.size.sm} color={iconColor} strokeWidth={icon.stroke.regular} />}
                  accessibilityLabel="Post to this community"
                  onPress={() => router.push(`/camera?mode=daily&community=${info.id}` as Href)}
                />
              ) : null}
              {/* Settings — all members (18); admin-only sections gate inside. */}
              <IconButton
                variant="plain"
                icon={<Settings size={icon.size.sm} color={iconColor} strokeWidth={icon.stroke.regular} />}
                accessibilityLabel="Community settings"
                onPress={() => router.push(`/community/${info.id}/settings` as Href)}
              />
            </View>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + space[6] + 4 }}
        >
          <CommunityHeader community={info} onOpenMembers={() => router.push(`/community/${id}/members` as Href)} />

          {/* Join / Request / Leave / Invite */}
          <View
            style={{
              marginTop: space[3],
              paddingHorizontal: space[4],
              flexDirection: "row",
              gap: space[2] + 2,
              alignSelf: "flex-start"
            }}
          >
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
                <Button
                  onPress={() => requestToJoin.mutate(undefined, { onSuccess: () => showToast("Request sent") })}
                  loading={requestToJoin.isPending}
                >
                  Request to join
                </Button>
              )
            ) : (
              <Button onPress={joinNow} loading={join.isPending}>
                Join community
              </Button>
            )}
          </View>

          {/* Managers: pending join requests */}
          {perms.manage_members && (requests.data ?? []).length > 0 ? (
            <View
              style={{
                marginTop: space[4],
                marginHorizontal: space[4],
                borderRadius: radius.md,
                backgroundColor: tokens.bg.raised,
                overflow: "hidden"
              }}
            >
              <SectionLabel style={{ paddingTop: space[3] + 2, paddingHorizontal: space[3] + 2, paddingBottom: 0 }}>
                {`Pending requests · ${(requests.data ?? []).length}`}
              </SectionLabel>
              {(requests.data ?? []).map((req) => (
                <JoinRequestRow
                  key={req.user_id}
                  name={req.profile?.display_name ?? "Someone"}
                  username={req.profile?.username ?? "user"}
                  avatarUrl={req.profile?.avatar_url}
                  onPress={() => req.profile && router.push(`/user/${req.profile.username}` as Href)}
                  onApprove={() => respond.mutate({ userId: req.user_id, accept: true })}
                  onDeny={() => respond.mutate({ userId: req.user_id, accept: false })}
                />
              ))}
            </View>
          ) : null}

          {/* Locked (private, non-member): hide all content */}
          {locked ? (
            <EmptyState
              icon={<Lock size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
              title="This community is private"
              body="Request to join to see posts, chat, and rankings. An admin has to approve you."
            />
          ) : (
            <>
              <TabRow tabs={tabs} value={tab} onChange={setTab} />

              {tab === "Feed" ? (
                <CommunityFeedGrid
                  posts={posts.data ?? []}
                  loading={posts.isLoading}
                  emptyBody={
                    perms.post ? "No posts yet. Share a daily to this community from the camera." : "No posts yet."
                  }
                  onOpenAuthor={(post) =>
                    post.user_id === userId ? router.push("/(tabs)/profile") : router.push(`/user/${post.username}`)
                  }
                />
              ) : null}

              {tab === "Chat" ? (
                !isMember ? (
                  <View
                    style={{ alignItems: "center", paddingTop: space[8], paddingHorizontal: space[8], gap: space[3] }}
                  >
                    <Text variant="meta" className="text-center">
                      Join the community to see and send messages.
                    </Text>
                    <RelButton label="Join" kind="primary" onPress={joinNow} />
                  </View>
                ) : (
                  // Messages only — the composer is pinned at the bottom of the
                  // screen (outside this ScrollView), like a standard chat UI (15).
                  <View style={{ minHeight: 280, gap: space[1], paddingHorizontal: space[4], paddingTop: space[2] }}>
                    <CommunityChatList
                      messages={messages.data ?? []}
                      loading={messages.isLoading}
                      userId={userId}
                      joinedAtById={joinedAtById}
                      communityCreatedAt={info.createdAt}
                    />
                  </View>
                )
              ) : null}

              {tab === "Board" ? (
                !isMember ? (
                  <Text variant="meta" className="px-8 pt-8 text-center">
                    Join the community to see its board.
                  </Text>
                ) : (
                  <CommunityBoard
                    rows={board.data?.rows}
                    loading={board.isLoading}
                    userId={userId}
                    communityCreatedAt={info.createdAt}
                  />
                )
              ) : null}

              {tab === "Members" ? (
                members.isLoading ? (
                  <SkeletonRows count={5} avatar={44} />
                ) : (
                  <View style={{ paddingTop: space[1] }}>
                    {(members.data ?? []).map((member) => {
                      const me = member.user_id === userId;
                      return (
                        <MemberRow
                          key={member.user_id}
                          member={member}
                          communityCreatedAt={info.createdAt}
                          isMe={me}
                          onPress={() =>
                            me
                              ? router.push("/(tabs)/profile" as Href)
                              : member.profile && router.push(`/user/${member.profile.username}` as Href)
                          }
                        />
                      );
                    })}
                    {isMember ? (
                      // Spec: leave from the member list, one tap, no confirm.
                      // Chat + board access end immediately; history is untouched.
                      <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space[2],
              marginHorizontal: space[4],
              marginTop: space[1] + 2,
              marginBottom: insets.bottom + space[2] + 2,
              paddingVertical: space[3],
              borderRadius: radius.pill,
              backgroundColor: tokens.bg.raised
            }}
          >
            <MessageSquareOff size={icon.size.xs - 1} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
            <Text variant="meta-strong" className="text-fog">
              {perms.role_name ? `${perms.role_name} can read but not send here` : "Chat is read-only for your role"}
            </Text>
          </View>
        ) : null}

        {/* Pinned chat composer — bottom of the screen, rises with the keyboard (15). */}
        {tab === "Chat" && canChat && !locked && perms.send_messages ? (
          <ChatComposer
            draft={draft}
            onChangeDraft={setDraft}
            onSend={send}
            canSend={draft.trim().length > 0}
            sending={sendMessage.isPending}
            placeholder="Message the community…"
            editable
            keyboardVisible={keyboardVisible}
            replyTo={null}
            replyToName=""
            onCancelReply={() => undefined}
            pendingMedia={null}
            onRemoveMedia={() => undefined}
          />
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
