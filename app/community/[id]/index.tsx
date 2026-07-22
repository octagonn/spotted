import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Camera, Check, Globe, Lock, MapPin, Send, Settings, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

import { MessageBubble, TimeSeparator } from "@/components/friends/ChatBubbles";
import { Avatar } from "@/components/ui/Avatar";
import { Button, RelButton } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import {
  useCommunity,
  useCommunityJoinRequests,
  useCommunityMessages,
  useCommunityMessagesRealtime,
  useCommunityPosts,
  useInviteToCommunity,
  useJoinCommunity,
  useLeaveCommunity,
  useMyJoinRequest,
  useRequestToJoin,
  useRespondJoinRequest,
  useSendCommunityMessage
} from "@/hooks/queries/useCommunities";
import { useMarkCommunityRead } from "@/hooks/queries/useCommunitiesHome";
import { useFriends } from "@/hooks/queries/useFriends";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

type CommunityTab = "Posts" | "Chat" | "Rankings";

/** Sheet: invite friends to the community. Invited state per row. */
function InviteFriendsSheet({ communityId, communityName }: { communityId: string; communityName: string }) {
  const friends = useFriends();
  const invite = useInviteToCommunity(communityId);
  const [invited, setInvited] = useState<Set<string>>(new Set());

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
      <View style={{ maxHeight: 320 }}>
        {friends.isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={colors.mist} />
          </View>
        ) : (friends.data ?? []).length === 0 ? (
          <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            No friends yet — add your crew from the Friends tab first.
          </Text>
        ) : (
          (friends.data ?? []).map((friend) => (
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
          ))
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
  const isAdmin = community.data?.isAdmin ?? false;
  const isGym = community.data?.type === "gym";
  const isPrivate = community.data?.privacy === "private";
  const locked = isPrivate && !isMember;

  const [tab, setTab] = useState<CommunityTab>(initialTab === "Chat" ? "Chat" : "Posts");
  const [draft, setDraft] = useState("");

  const posts = useCommunityPosts(id, !locked);
  const messages = useCommunityMessages(id, isMember);
  useCommunityMessagesRealtime(isMember ? id : undefined);
  const sendMessage = useSendCommunityMessage(id);
  const join = useJoinCommunity();
  const leave = useLeaveCommunity();
  const myRequest = useMyJoinRequest(isPrivate && !isMember ? id : undefined);
  const requestToJoin = useRequestToJoin(id);
  const requests = useCommunityJoinRequests(id, isAdmin);
  const respond = useRespondJoinRequest(id);
  const markRead = useMarkCommunityRead();

  // Opening the community clears its unread dot on the Communities tab.
  useEffect(() => {
    if (id && isMember) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isMember]);

  const tabs: CommunityTab[] = isGym ? ["Posts", "Chat", "Rankings"] : ["Posts", "Chat"];

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
    if (!text || !isMember) return;
    setDraft("");
    sendMessage.mutate(text);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  if (community.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.white} />
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
        title={info.name}
        sub={`${info.type[0].toUpperCase()}${info.type.slice(1)} community`}
        right={
          isMember ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* Post directly to this community (16) — existing camera flow with
                  this community pre-selected; gym rules still apply there. */}
              <Pressable onPress={() => router.push(`/camera?mode=daily&community=${info.id}` as Href)} accessibilityLabel="Post to this community" hitSlop={8}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                  <Camera size={17} color={colors.mist} strokeWidth={2} />
                </View>
              </Pressable>
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
          <View style={{ width: 68, height: 68, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.iron, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" }}>
            {info.photoUrl ? (
              <Image source={{ uri: info.photoUrl }} contentFit="cover" style={{ width: 68, height: 68 }} />
            ) : (
              <Icon size={26} color={colors.mist} />
            )}
          </View>
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
            <>
            <Button variant="ghost" onPress={() => leave.mutate(info.id, { onSuccess: () => showToast(`Left ${info.name}`) })} loading={leave.isPending}>
              Joined ✓ — leave
            </Button>
            <Button
              variant="ghost"
              onPress={() => sheet.open(<InviteFriendsSheet communityId={info.id} communityName={info.name} />)}
            >
              Invite friends
            </Button>
            </>
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

        {/* Admin: pending join requests */}
        {isAdmin && (requests.data ?? []).length > 0 ? (
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
          <View style={{ alignItems: "center", paddingTop: 44, paddingHorizontal: 40 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
              <Lock size={22} color={colors.silver} strokeWidth={2} />
            </View>
            <Text style={{ marginTop: 16, fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white, textAlign: "center" }}>
              This community is private
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: colors.fog, textAlign: "center" }}>
              Request to join to see posts, chat, and rankings. An admin has to approve you.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 22, marginTop: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
              {tabs.map((item) => (
                <Pressable key={item} onPress={() => setTab(item)}>
                  <View style={{ paddingBottom: 10, borderBottomWidth: tab === item ? 2 : 0, borderBottomColor: colors.white }}>
                    <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: tab === item ? colors.white : colors.fog }}>
                      {item}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {tab === "Posts" ? (
              (posts.data ?? []).length === 0 ? (
                <Text style={{ paddingTop: 32, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                  {posts.isLoading ? "Loading posts…" : "No posts yet. Share a daily to this community from the camera."}
                </Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingTop: 2 }}>
                  {(posts.data ?? []).map((post) => (
                    <Pressable
                      key={post.id}
                      onPress={() => (post.user_id === userId ? router.push("/(tabs)/profile") : router.push(`/user/${post.username}`))}
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
                    <Text style={{ paddingTop: 32, textAlign: "center", fontSize: 12, color: colors.fog }}>
                      {messages.isLoading ? "Loading…" : "No messages yet. Say something."}
                    </Text>
                  ) : (
                    <>
                      <TimeSeparator label="Chat" />
                      {(messages.data ?? []).map((message, index, list) => {
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

            {tab === "Rankings" ? (
              <Text style={{ paddingTop: 32, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 32 }}>
                Gym rankings are coming soon — streaks, max lifts, and check-in leaders.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Pinned chat input — bottom of the screen, rises with the keyboard (15). */}
      {tab === "Chat" && isMember && !locked ? (
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
          <Pressable onPress={send} disabled={!draft.trim() || sendMessage.isPending}>
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
