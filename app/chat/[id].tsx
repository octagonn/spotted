import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { CornerUpLeft, EyeOff, Forward, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable as RNPressable, ScrollView, View } from "react-native";

import { ChatComposer, type PendingMedia, type ReplyTarget } from "@/components/chat/ChatComposer";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageActionMenu, type MessageAction } from "@/components/chat/MessageActionMenu";
import {
  ChatMediaBubble,
  ChatPhotoViewer,
  ShareCard,
  StoryReplyPreview,
  ViewOnceBubble,
  ViewOnceViewer
} from "@/components/chat/MessageMedia";
import { MessageBubble, TimeSeparator } from "@/components/friends/ChatBubbles";
import { useMockChatStore } from "@/components/friends/chatStore";
import { ForwardSheet } from "@/components/friends/ForwardSheet";
import { isMockThreadId, MOCK_CONVERSATIONS } from "@/components/friends/mockConversations";
import { PresenceLine, presenceStatus } from "@/components/friends/PresenceLine";
import { useInboxThreadActions } from "@/components/friends/useInboxThreads";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { EMPTY_ART } from "@/lib/emptyStateArt";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { SkeletonChatBubbles } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import {
  useActiveConversation,
  useActivityStatus,
  useChatPresence,
  useHeartbeat
} from "@/hooks/queries/useChatPresence";
import {
  useConversation,
  useGroupInfo,
  useMarkConversationRead,
  useMarkMessageViewed,
  useMessages,
  useMessagesRealtime,
  useSendMediaMessage,
  useSendMessage,
  type ChatMessage
} from "@/hooks/queries/useMessages";
import {
  useBlockedUsers,
  useHideMessage,
  useMessageHides,
  useMessageReactions,
  useReactToMessage,
  useUnsendMessage
} from "@/hooks/queries/useMessagesExtras";
import { useMarkConversationNotificationsRead } from "@/hooks/queries/useNotifications";
import { useProfileById } from "@/hooks/queries/useProfile";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { groupDisplayName } from "@/lib/groupName";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/**
 * Stable fallback for the sent-messages selector. Returning a fresh `[]` from
 * a zustand selector makes every store snapshot look "changed", which sends
 * useSyncExternalStore into an infinite re-render loop and crashes the screen.
 */
const NO_SENT_MESSAGES: string[] = [];

/** Unsend window (ms) for your own text messages. */
const UNSEND_WINDOW_MS = 15 * 60_000;

/**
 * Chat thread. Owns the conversation data + send/record/pick logic and
 * composes ChatHeader → message list → ChatComposer, with the full-screen
 * viewers and the long-press action menu layered on top.
 */
export default function ChatScreen() {
  const { id, group } = useLocalSearchParams<{ id: string; group?: string }>();
  const router = useRouter();
  const mock = isMockThreadId(id);
  // Group threads route as /chat/<conversation id>?group=1 — there is no
  // single peer, so the profile/conversation-by-peer hooks stay disabled.
  const isGroup = group === "1";
  const realProfileId = mock || isGroup ? undefined : id;
  const keyboardVisible = useKeyboardVisible();
  const userId = useAuthStore((state) => state.userId);
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState("");
  const mockSent = useMockChatStore((state) =>
    mock && id ? (state.sentMessages[id] ?? NO_SENT_MESSAGES) : NO_SENT_MESSAGES
  );
  const markMockRead = useMockChatStore((state) => state.markRead);
  const sendMock = useMockChatStore((state) => state.sendLocal);
  const inboxActions = useInboxThreadActions();

  const sheet = useSheet();
  const profile = useProfileById(realProfileId);
  const conversation = useConversation(realProfileId);
  const groupInfo = useGroupInfo(isGroup ? id : null, isGroup);
  const conversationId = isGroup ? (id ?? null) : (conversation.data ?? null);
  const messages = useMessages(conversationId);
  const sendReal = useSendMessage(conversationId);
  const sendMedia = useSendMediaMessage(conversationId);

  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  // Media staged in the composer (gallery pick or camera shot) — sent on Send,
  // never auto-sent. Camera shots go out as view-once.
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [viewOnceOpen, setViewOnceOpen] = useState<ChatMessage | null>(null);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const markViewed = useMarkMessageViewed(conversationId);
  const reactions = useMessageReactions(
    conversationId,
    (messages.data ?? []).map((m) => m.id)
  );
  const react = useReactToMessage(conversationId);
  const unsend = useUnsendMessage(conversationId);
  const hides = useMessageHides();
  const hide = useHideMessage();
  const blocked = useBlockedUsers();
  const presence = useChatPresence(conversationId, realProfileId);
  // Open thread → no push / no banner for its own messages…
  useActiveConversation(conversationId);
  // …and its "sent you a message" notifications count as seen.
  const markConversationRead = useMarkConversationNotificationsRead(conversationId);
  useEffect(() => {
    if (conversationId) markConversationRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  const activity = useActivityStatus(realProfileId);
  useHeartbeat();
  const isBlocked = Boolean(realProfileId && blocked.data?.has(realProfileId));

  // Voice recording (expo-audio).
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const toggleRecord = async () => {
    if (recording) {
      setRecording(false);
      try {
        await recorder.stop();
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
        const uri = recorder.uri;
        if (uri) {
          sendMedia.mutate(
            { localUri: uri, kind: "audio" },
            { onSuccess: inboxActions.invalidate, onError: () => showToast("Couldn't send the voice message") }
          );
        } else {
          showToast("Recording didn't save — try again");
        }
      } catch {
        showToast("Recording failed — try again");
      }
      return;
    }
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showToast("Enable microphone access in Settings to send voice messages");
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordSecs(0);
      setRecording(true);
    } catch {
      showToast("Couldn't start recording");
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
        videoMaxDuration: 60
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      // Stage in the composer — the user confirms with Send.
      setPendingMedia({ uri: asset.uri, kind: asset.type === "video" ? "video" : "image", viewOnce: false });
    } catch {
      showToast("Couldn't open your photo library");
    }
  };

  useMessagesRealtime(conversationId);
  useMarkConversationRead(conversationId, messages.data?.length, isGroup);

  useEffect(() => {
    if (mock && id) markMockRead(id);
  }, [id, markMockRead, mock]);

  const mockConversation = mock ? MOCK_CONVERSATIONS[id] : null;
  const groupMembers = useMemo(() => groupInfo.data?.members ?? [], [groupInfo.data]);
  const memberById = useMemo(() => new Map(groupMembers.map((m) => [m.id, m])), [groupMembers]);
  // "Who actually added you" — the group creator, resolved from the member list.
  const groupCreatorName = groupInfo.data?.createdBy
    ? (memberById.get(groupInfo.data.createdBy)?.name?.split(" ")[0] ?? null)
    : null;
  const title = isGroup
    ? groupDisplayName(groupInfo.data?.title, groupMembers, userId)
    : (mockConversation?.title ?? profile.data?.display_name ?? "Conversation");
  const sub = isGroup
    ? groupMembers.length
      ? `${groupMembers.length} members`
      : undefined
    : (mockConversation?.sub ?? (profile.data?.username ? `@${profile.data.username}` : undefined));
  const headerPresence = presenceStatus({
    typing: presence.otherTyping,
    online: presence.otherOnline,
    lastSeenAt: activity.data?.lastSeenAt ?? null,
    statusVisible: activity.data?.visible ?? false
  });

  const realItems = useMemo(() => messages.data ?? [], [messages.data]);
  // Hide messages the user deleted from their own view; keep unsent ones
  // (rendered as a tombstone). Index by id for quote-reply lookups.
  const visibleItems = useMemo(() => realItems.filter((m) => !hides.data?.has(m.id)), [realItems, hides.data]);
  const byId = useMemo(() => new Map(realItems.map((m) => [m.id, m])), [realItems]);

  // Read receipt: only when MY message is the last one in the thread.
  const lastItem = realItems.length ? realItems[realItems.length - 1] : undefined;
  const lastMine = lastItem?.sender_id === userId ? lastItem : undefined;
  const lastMineRead = Boolean(lastMine?.read_at);
  const seenLabel = useMemo(() => {
    if (!lastMine?.read_at) return "";
    const mins = Math.max(1, Math.round((Date.now() - new Date(lastMine.read_at).getTime()) / 60000));
    if (mins < 60) return `${mins}m ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / (60 * 24))}d ago`;
  }, [lastMine?.read_at]);

  const sendReady = mock || Boolean(conversationId);
  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const send = () => {
    const text = draft.trim();
    if (!sendReady || (!text && !pendingMedia)) return;
    if (pendingMedia) {
      const staged = pendingMedia;
      setPendingMedia(null);
      sendMedia.mutate(
        { localUri: staged.uri, kind: staged.kind, viewOnce: staged.viewOnce },
        {
          onSuccess: inboxActions.invalidate,
          onError: () => showToast(staged.kind === "video" ? "Couldn't send the video" : "Couldn't send the photo")
        }
      );
    }
    if (!text) {
      scrollToEnd();
      return;
    }
    setDraft("");
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);
    if (mock && id) {
      sendMock(id, text);
    } else {
      sendReal.mutate(
        { content: text, replyToId: replyId },
        {
          onSuccess: inboxActions.invalidate,
          onError: (err) => {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("blocked")) showToast("You can't message this person");
            else if (msg.includes("request_pending")) showToast("Wait for them to accept your request");
            else showToast("Couldn't send — try again");
          }
        }
      );
    }
    scrollToEnd();
  };

  // Long-press menu on a message: emoji quick-bar + actions.
  const [actionTarget, setActionTarget] = useState<{ message: ChatMessage; mine: boolean } | null>(null);
  const messageActions = (message: ChatMessage, mine: boolean) => setActionTarget({ message, mine });
  const actionMenuItems = (): MessageAction[] => {
    if (!actionTarget) return [];
    const { message, mine } = actionTarget;
    const withinWindow = Date.now() - new Date(message.sent_at).getTime() < UNSEND_WINDOW_MS;
    const items: MessageAction[] = [
      {
        label: "Reply",
        icon: CornerUpLeft,
        onPress: () => setReplyTo({ id: message.id, text: message.content ?? "Media", mine })
      }
    ];
    if (message.content) {
      items.push({
        label: "Forward",
        icon: Forward,
        onPress: () => sheet.open(<ForwardSheet content={message.content ?? ""} />)
      });
    }
    if (mine && withinWindow && message.media_url === null) {
      items.push({
        label: "Unsend for everyone",
        icon: Trash2,
        destructive: true,
        onPress: () => unsend.mutate(message.id)
      });
    }
    items.push({ label: "Delete for me", icon: EyeOff, destructive: true, onPress: () => hide.mutate(message.id) });
    return items;
  };

  const openDetails = () => {
    if (!conversationId) return;
    router.push(
      (isGroup ? `/chat-details/${conversationId}` : `/chat-details/${conversationId}?peer=${realProfileId}`) as Href
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ChatHeader
        title={title}
        avatarUrl={isGroup ? null : profile.data?.avatar_url}
        accessibilityHint={headerPresence || undefined}
        onBack={() => router.back()}
        onOpenDetails={conversationId && (isGroup || realProfileId) ? openDetails : undefined}
        subtitle={
          mock || isGroup ? (
            sub ? (
              <Text variant="meta" numberOfLines={1}>
                {sub}
              </Text>
            ) : null
          ) : (
            <PresenceLine
              username={profile.data?.username}
              typing={presence.otherTyping}
              online={presence.otherOnline}
              lastSeenAt={activity.data?.lastSeenAt ?? null}
              statusVisible={activity.data?.visible ?? false}
            />
          )
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? space[2] : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          // Dragging the thread down tucks the keyboard away (iOS Messages).
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: space[2],
            paddingHorizontal: space[4],
            paddingBottom: space[4]
          }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Tapping empty space in the thread dismisses the keyboard; bubbles
              keep their own presses. */}
          <RNPressable onPress={Keyboard.dismiss} style={{ flexGrow: 1, gap: space[1] }} accessible={false}>
            {mockConversation ? (
              <>
                {mockConversation.seed.map((item, index) =>
                  item.kind === "sep" ? (
                    <TimeSeparator key={`sep-${index}`} label={item.label} />
                  ) : (
                    <MessageBubble
                      key={`msg-${index}`}
                      mine={item.mine}
                      text={item.text}
                      senderFirst={mockConversation.group ? item.senderFirst : undefined}
                    />
                  )
                )}
                {mockSent.map((text, index) => (
                  <MessageBubble key={`sent-${index}`} mine text={text} />
                ))}
              </>
            ) : visibleItems.length ? (
              <>
                <TimeSeparator label="Today" />
                {visibleItems.map((message) => {
                  const mine = message.sender_id === userId;
                  const rows = reactions.data?.[message.id] ?? [];
                  const emojis = Array.from(new Set(rows.map((r) => r.emoji)));
                  const parent = message.reply_to_id ? byId.get(message.reply_to_id) : null;
                  if (message.deleted_at) {
                    return (
                      <View
                        key={message.id}
                        style={{
                          alignSelf: mine ? "flex-end" : "flex-start",
                          marginVertical: 3,
                          paddingHorizontal: space[3] + 2,
                          paddingVertical: space[2],
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: tokens.border.default
                        }}
                      >
                        <Text variant="meta" className="italic">
                          {mine ? "You unsent a message" : "Unsent a message"}
                        </Text>
                      </View>
                    );
                  }
                  // The long-press actions are unreachable by a screen reader —
                  // expose them as rotor actions routed to the same handlers.
                  const withinWindow = Date.now() - new Date(message.sent_at).getTime() < UNSEND_WINDOW_MS;
                  const canUnsend = mine && withinWindow && message.media_url === null;
                  const a11yActions = [
                    { name: "react", label: "React" },
                    { name: "reply", label: "Reply" },
                    ...(message.content ? [{ name: "forward", label: "Forward" }] : []),
                    ...(canUnsend ? [{ name: "unsend", label: "Unsend for everyone" }] : []),
                    { name: "delete", label: "Delete for me" }
                  ];
                  const senderMember = isGroup ? memberById.get(message.sender_id) : undefined;
                  return (
                    <RNPressable
                      key={message.id}
                      onLongPress={() => messageActions(message, mine)}
                      delayLongPress={220}
                      accessibilityActions={a11yActions}
                      onAccessibilityAction={(event) => {
                        switch (event.nativeEvent.actionName) {
                          case "react":
                            messageActions(message, mine);
                            break;
                          case "reply":
                            setReplyTo({ id: message.id, text: message.content ?? "Media", mine });
                            break;
                          case "forward":
                            if (message.content) sheet.open(<ForwardSheet content={message.content ?? ""} />);
                            break;
                          case "unsend":
                            if (canUnsend) unsend.mutate(message.id);
                            break;
                          case "delete":
                            hide.mutate(message.id);
                            break;
                        }
                      }}
                    >
                      {parent ? (
                        <View
                          style={{
                            alignSelf: mine ? "flex-end" : "flex-start",
                            maxWidth: "78%",
                            marginBottom: -2,
                            paddingLeft: space[2] + 2,
                            borderLeftWidth: 2,
                            borderLeftColor: tokens.border.strong
                          }}
                        >
                          <Text variant="meta" numberOfLines={1}>
                            {parent.content ?? "Media"}
                          </Text>
                        </View>
                      ) : null}
                      {/* Received messages show the sender's avatar to the left;
                          groups resolve each sender from the member list. */}
                      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[1] + 3 }}>
                        {!mine ? (
                          <Avatar
                            name={isGroup ? (senderMember?.name ?? "?") : title}
                            uri={isGroup ? (senderMember?.avatarUrl ?? null) : profile.data?.avatar_url}
                            size={26}
                          />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          {message.reply_story_media ? (
                            <StoryReplyPreview path={message.reply_story_media} mine={mine} />
                          ) : null}
                          {message.kind === "share" && message.shared_kind ? (
                            <ShareCard
                              mine={mine}
                              label={message.content ?? "Shared"}
                              sharedKind={message.shared_kind}
                              onOpen={() => {
                                if (message.shared_kind === "post" && message.shared_id)
                                  router.push(`/post/${message.shared_id}`);
                                else if (
                                  (message.shared_kind === "checkin" || message.shared_kind === "stream") &&
                                  message.shared_id
                                )
                                  router.push(`/gym/${message.shared_id}`);
                              }}
                            />
                          ) : message.view_once ? (
                            <ViewOnceBubble message={message} mine={mine} onOpen={setViewOnceOpen} />
                          ) : message.media_url ? (
                            <ChatMediaBubble
                              path={message.media_url}
                              mine={mine}
                              onOpen={setPhotoViewer}
                              onLongPress={() => messageActions(message, mine)}
                            />
                          ) : (
                            <MessageBubble
                              mine={mine}
                              text={message.content ?? ""}
                              senderName={isGroup ? (senderMember?.name ?? "Member") : title}
                              senderFirst={
                                isGroup && !mine ? (senderMember?.name ?? "Member").split(" ")[0] : undefined
                              }
                            />
                          )}
                        </View>
                      </View>
                      {emojis.length ? (
                        <View
                          style={{
                            alignSelf: mine ? "flex-end" : "flex-start",
                            flexDirection: "row",
                            gap: 3,
                            marginTop: -2,
                            marginBottom: 2,
                            paddingHorizontal: space[2],
                            paddingVertical: 2,
                            borderRadius: radius.pill,
                            backgroundColor: tokens.bg.raised,
                            borderWidth: 1,
                            borderColor: tokens.border.default
                          }}
                        >
                          {emojis.map((e) => (
                            <Text key={e} variant="label">
                              {e}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </RNPressable>
                  );
                })}
                {/* Delivery status under my most recent message. Hidden in
                    groups — the shared read stamp can't say WHO saw it. */}
                {lastMine && !lastMine.deleted_at && !isGroup ? (
                  <Text variant="mono" className="self-end pr-1 pt-[2px] text-[10px]">
                    {lastMineRead ? `Seen ${seenLabel}` : "Delivered"}
                  </Text>
                ) : null}
              </>
            ) : conversation.isError ? (
              <EmptyState title="Couldn't open this chat" center paddingTop={space[12]}>
                <Pressable
                  onPress={() => void conversation.refetch()}
                  haptic="none"
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  <Text variant="meta-strong" className="text-white">
                    Try again
                  </Text>
                </Pressable>
              </EmptyState>
            ) : messages.isLoading || conversation.isLoading ? (
              <SkeletonChatBubbles />
            ) : (
              // Empty thread after a friend-add: system-style prompt to start the DM.
              <EmptyState
                art={EMPTY_ART.chat}
                title={
                  isGroup
                    ? groupCreatorName
                      ? groupInfo.data?.createdBy === userId
                        ? "You created this group."
                        : `${groupCreatorName} added you.`
                      : "You're in this group."
                    : `${profile.data?.display_name ?? title} added you.`
                }
                body="Start a message now."
                center
                paddingTop={space[12]}
              />
            )}
          </RNPressable>
        </ScrollView>

        <ChatComposer
          draft={draft}
          onChangeDraft={(v) => {
            setDraft(v);
            if (!mock) presence.notifyTyping();
          }}
          onSend={send}
          canSend={Boolean(draft.trim() || pendingMedia) && sendReady}
          sending={sendReal.isPending}
          placeholder={isBlocked ? "You blocked this person" : "Message…"}
          editable={!isBlocked}
          keyboardVisible={keyboardVisible}
          replyTo={replyTo}
          replyToName={title}
          onCancelReply={() => setReplyTo(null)}
          pendingMedia={pendingMedia}
          onRemoveMedia={() => setPendingMedia(null)}
          mediaActions={
            !mock && sendReady
              ? {
                  disabled: sendMedia.isPending || !conversationId,
                  onCamera: () => conversationId && router.push(`/chat-camera?conversation=${conversationId}` as Href),
                  onPickImage: () => void pickImage(),
                  onToggleRecord: () => void toggleRecord(),
                  recording,
                  recordSecs
                }
              : undefined
          }
        />
      </KeyboardAvoidingView>

      {photoViewer ? <ChatPhotoViewer uri={photoViewer} onClose={() => setPhotoViewer(null)} /> : null}

      {viewOnceOpen?.media_url ? (
        <ViewOnceViewer
          path={viewOnceOpen.media_url}
          onConsume={() => markViewed.mutate(viewOnceOpen.id)}
          onClose={() => setViewOnceOpen(null)}
        />
      ) : null}

      <MessageActionMenu
        visible={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        onReact={(emoji) => {
          if (actionTarget) react.mutate({ messageId: actionTarget.message.id, emoji });
        }}
        actions={actionMenuItems()}
        preview={
          actionTarget
            ? {
                text: actionTarget.message.content ?? (actionTarget.message.media_url ? "Photo" : null),
                mine: actionTarget.mine
              }
            : null
        }
      />
    </View>
  );
}
