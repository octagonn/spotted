import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder
} from "expo-audio";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, CornerUpLeft, ImagePlus, Mic, MoreVertical, Pause, Play, Send, Share2, Square, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable as RNPressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { MessageActionMenu, type MessageAction } from "@/components/chat/MessageActionMenu";
import { MessageBubble, TimeSeparator } from "@/components/friends/ChatBubbles";
import { ForwardSheet } from "@/components/friends/ForwardSheet";
import { PresenceLine } from "@/components/friends/PresenceLine";
import { useMockChatStore } from "@/components/friends/chatStore";
import { isMockThreadId, MOCK_CONVERSATIONS } from "@/components/friends/mockConversations";
import { useInboxThreadActions } from "@/components/friends/useInboxThreads";
import { Avatar } from "@/components/ui/Avatar";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { Pressable } from "@/components/ui/Pressable";
import {
  useConversation,
  useMarkConversationRead,
  useMessages,
  useMessagesRealtime,
  useSendMediaMessage,
  useSendMessage,
  type ChatMessage
} from "@/hooks/queries/useMessages";
import {
  useBlockedUsers,
  useConversationMuted,
  useHideMessage,
  useMessageHides,
  useMessageReactions,
  useReactToMessage,
  useSetBlocked,
  useSetConversationMuted,
  useUnsendMessage
} from "@/hooks/queries/useMessagesExtras";
import { useActivityStatus, useChatPresence, useHeartbeat } from "@/hooks/queries/useChatPresence";
import { useProfileById } from "@/hooks/queries/useProfile";
import { ReportSheet } from "@/components/ReportSheet";
import { useSheet } from "@/components/ui/Sheet";
import { signedMessageUrl, signedPostUrl } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { tokens } from "@/theme/tokens";
import { colors } from "@/theme/colors";

/** Voice-note bubble: play/pause + progress + elapsed time. */
function AudioBubble({ uri, mine }: { uri: string | null; mine: boolean }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    try {
      if (status.playing) {
        player.pause();
      } else {
        if (status.didJustFinish) player.seekTo(0).catch(() => {});
        player.play();
      }
    } catch {
      // Player torn down — ignore.
    }
  };
  const duration = Math.max(1, Math.round(status.duration || 0));
  const current = Math.min(duration, Math.round(status.currentTime || 0));
  const fg = mine ? colors.black : colors.white;
  return (
    <Pressable onPress={toggle} accessibilityLabel={status.playing ? "Pause voice message" : "Play voice message"} haptic={false}>
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          maxWidth: "78%",
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 14,
          backgroundColor: mine ? colors.white : colors.graphite,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.iron
        }}
      >
        {status.playing ? (
          <Pause size={16} color={fg} strokeWidth={2.2} fill={fg} />
        ) : (
          <Play size={16} color={fg} strokeWidth={2.2} fill={fg} />
        )}
        <View style={{ width: 110, height: 3, borderRadius: 1.5, backgroundColor: mine ? "rgba(0,0,0,0.2)" : colors.iron }}>
          <View
            style={{
              width: `${Math.min(100, (current / duration) * 100)}%`,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: fg
            }}
          />
        </View>
        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: fg }}>
          {`0:${String(status.playing || current > 0 ? current : duration).padStart(2, "0")}`}
        </Text>
      </View>
    </Pressable>
  );
}

/** Image or voice message — resolves the private-bucket signed URL. */
/** Thumbnail of the story a DM is replying to (story media lives in the posts bucket). */
function StoryReplyPreview({ path, mine }: { path: string; mine: boolean }) {
  const media = useQuery({
    queryKey: ["story-reply-thumb", path],
    staleTime: 50 * 60_000,
    queryFn: () => signedPostUrl(path)
  });
  return (
    <View style={{ alignSelf: mine ? "flex-end" : "flex-start", alignItems: mine ? "flex-end" : "flex-start", marginBottom: -4 }}>
      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: colors.fog, marginBottom: 4, marginHorizontal: 4 }}>
        {mine ? "You replied to their story" : "Replied to your story"}
      </Text>
      <View style={{ width: 54, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
        {media.data ? <Image source={{ uri: media.data }} style={{ width: 54, height: 84 }} contentFit="cover" /> : null}
      </View>
    </View>
  );
}

/** Video message bubble — inline looping player. */
function VideoBubble({ uri, mine }: { uri: string | null; mine: boolean }) {
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = true;
    p.muted = false;
  });
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: colors.graphite,
        borderWidth: mine ? 0 : 1,
        borderColor: colors.iron
      }}
    >
      {uri ? (
        <VideoView player={player} style={{ width: 210, height: 270 }} contentFit="cover" nativeControls />
      ) : (
        <View style={{ width: 210, height: 270 }} />
      )}
    </View>
  );
}

/** In-app share card (#8) — a tappable preview of a shared post/check-in/stream. */
function ShareCard({
  mine,
  label,
  sharedKind,
  onOpen
}: {
  mine: boolean;
  label: string;
  sharedKind: string;
  sharedId: string | null;
  onOpen: () => void;
}) {
  const heading = sharedKind === "post" ? "Post" : sharedKind === "workout" ? "Workout" : sharedKind === "stream" ? "Gym stream" : "Gym check-in";
  return (
    <RNPressable onPress={onOpen} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: 240 }}>
      <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.iron, backgroundColor: colors.graphite }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.iron, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Share2 size={13} color={tokens.accent.gold} strokeWidth={2} />
          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: colors.fog }}>{heading}</Text>
        </View>
        <Text style={{ paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Geist_500Medium", fontSize: 13.5, color: colors.bone }}>{label}</Text>
      </View>
    </RNPressable>
  );
}

function ChatMediaBubble({ path, mine }: { path: string; mine: boolean }) {
  const media = useQuery({
    queryKey: ["msg-media", path],
    staleTime: 50 * 60_000,
    queryFn: () => signedMessageUrl(path)
  });
  const lower = path.toLowerCase();
  if (lower.endsWith(".m4a")) {
    return <AudioBubble uri={media.data ?? null} mine={mine} />;
  }
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) {
    return <VideoBubble uri={media.data ?? null} mine={mine} />;
  }
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: colors.graphite,
        borderWidth: mine ? 0 : 1,
        borderColor: colors.iron
      }}
    >
      {media.data ? (
        <Image source={{ uri: media.data }} style={{ width: 210, height: 270 }} contentFit="cover" />
      ) : (
        <View style={{ width: 210, height: 270 }} />
      )}
    </View>
  );
}

/**
 * Stable fallback for the sent-messages selector. Returning a fresh `[]` from
 * a zustand selector makes every store snapshot look "changed", which sends
 * useSyncExternalStore into an infinite re-render loop and crashes the screen.
 */
const NO_SENT_MESSAGES: string[] = [];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mock = isMockThreadId(id);
  const realProfileId = mock ? undefined : id;
  const insets = useSafeAreaInsets();
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
  const conversationId = conversation.data ?? null;
  const messages = useMessages(conversationId);
  const sendReal = useSendMessage(conversationId);
  const sendMedia = useSendMediaMessage(conversationId);

  // DM epic wiring.
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; mine: boolean } | null>(null);
  const reactions = useMessageReactions(conversationId, (messages.data ?? []).map((m) => m.id));
  const react = useReactToMessage(conversationId);
  const unsend = useUnsendMessage(conversationId);
  const hides = useMessageHides();
  const hide = useHideMessage();
  const blocked = useBlockedUsers();
  const setBlocked = useSetBlocked();
  const muted = useConversationMuted(conversationId);
  const setMuted = useSetConversationMuted(conversationId);
  const presence = useChatPresence(conversationId, realProfileId);
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.8, videoMaxDuration: 60 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const isVideo = asset.type === "video";
      sendMedia.mutate(
        { localUri: asset.uri, kind: isVideo ? "video" : "image" },
        { onSuccess: inboxActions.invalidate, onError: () => showToast(isVideo ? "Couldn't send the video" : "Couldn't send the photo") }
      );
    } catch {
      showToast("Couldn't open your photo library");
    }
  };
  useMessagesRealtime(conversationId);
  useMarkConversationRead(conversationId, messages.data?.length);

  useEffect(() => {
    if (mock && id) markMockRead(id);
  }, [id, markMockRead, mock]);

  const mockConversation = mock ? MOCK_CONVERSATIONS[id] : null;
  const title = mockConversation?.title ?? profile.data?.display_name ?? "Conversation";
  const sub = mockConversation?.sub ?? (profile.data?.username ? `@${profile.data.username}` : undefined);

  const realItems = useMemo(() => messages.data ?? [], [messages.data]);
  // Hide messages the user deleted from their own view (#11); keep unsent ones
  // (rendered as a tombstone). Index by id for quote-reply lookups.
  const visibleItems = useMemo(
    () => realItems.filter((m) => !(hides.data?.has(m.id))),
    [realItems, hides.data]
  );
  const byId = useMemo(() => new Map(realItems.map((m) => [m.id, m])), [realItems]);

  // Read receipt: only when MY message is the last one in the thread. If the
  // other person has replied since, my message is buried above theirs and no
  // receipt should show (otherwise both people see a stale "Seen" on an older
  // message they sent). The receipt renders pinned to the bottom of the list.
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

  const send = () => {
    const text = draft.trim();
    if (!text || !sendReady) return;
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
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  // Long-press menu on a message: iMessage-style emoji quick-bar (any emoji
  // via the full picker) + actions — replaces the old alert with three
  // hardcoded reactions.
  const [actionTarget, setActionTarget] = useState<{ message: ChatMessage; mine: boolean } | null>(null);
  const messageActions = (message: ChatMessage, mine: boolean) => setActionTarget({ message, mine });
  const actionMenuItems = (): MessageAction[] => {
    if (!actionTarget) return [];
    const { message, mine } = actionTarget;
    const withinWindow = Date.now() - new Date(message.sent_at).getTime() < 15 * 60_000;
    const items: MessageAction[] = [
      { label: "Reply", onPress: () => setReplyTo({ id: message.id, text: message.content ?? "Media", mine }) }
    ];
    if (message.content) {
      items.push({ label: "Forward", onPress: () => sheet.open(<ForwardSheet content={message.content ?? ""} />) });
    }
    if (mine && withinWindow && message.media_url === null) {
      items.push({ label: "Unsend for everyone", destructive: true, onPress: () => unsend.mutate(message.id) });
    }
    items.push({ label: "Delete for me", destructive: true, onPress: () => hide.mutate(message.id) });
    return items;
  };

  const openThreadMenu = () => {
    if (!realProfileId) return;
    Alert.alert(profile.data?.display_name ?? "Options", undefined, [
      {
        text: muted.data ? "Unmute notifications" : "Mute notifications",
        onPress: () => setMuted.mutate(!(muted.data ?? false))
      },
      {
        text: isBlocked ? "Unblock" : "Block",
        style: isBlocked ? "default" : "destructive",
        onPress: () =>
          setBlocked.mutate(
            { otherUserId: realProfileId, blocked: !isBlocked },
            { onSuccess: () => showToast(isBlocked ? "Unblocked" : "Blocked") }
          )
      },
      {
        text: "Report",
        style: "destructive",
        onPress: () => sheet.open(<ReportSheet contentType="user" contentId={realProfileId} label="user" reportedUserId={realProfileId} />)
      },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Chat header — big avatar + name, whole block opens their profile. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingTop: insets.top + 6,
          paddingHorizontal: 8,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.graphite
        }}
      >
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8} style={{ padding: 8 }}>
          <ChevronLeft size={26} color={colors.white} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (profile.data?.username) router.push(`/user/${profile.data.username}`);
          }}
          disabled={!profile.data?.username}
          accessibilityLabel={`Open ${title}'s profile`}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 12 }}
        >
          <Avatar name={title} uri={profile.data?.avatar_url} size={44} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 17.5, letterSpacing: 17.5 * -0.01, color: colors.white }}>
              {title}
            </Text>
            {mock ? (
              sub ? (
                <Text numberOfLines={1} style={{ marginTop: 1, fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.fog }}>
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
            )}
          </View>
        </Pressable>
        {!mock && realProfileId ? (
          <Pressable onPress={openThreadMenu} accessibilityLabel="Conversation options" hitSlop={8} style={{ padding: 8 }}>
            <MoreVertical size={22} color={colors.mist} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, gap: 4, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {mockConversation ? (
            <>
              {mockConversation.seed.map((item, index) => item.kind === "sep" ? (
                <TimeSeparator key={`sep-${index}`} label={item.label} />
              ) : (
                <MessageBubble
                  key={`msg-${index}`}
                  mine={item.mine}
                  text={item.text}
                  senderFirst={mockConversation.group ? item.senderFirst : undefined}
                />
              ))}
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
                    <Text key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", marginVertical: 3, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.iron, fontFamily: "Geist_400Regular", fontSize: 13, fontStyle: "italic", color: colors.fog }}>
                      {mine ? "You unsent a message" : "Unsent a message"}
                    </Text>
                  );
                }
                return (
                  <RNPressable key={message.id} onLongPress={() => messageActions(message, mine)} delayLongPress={220}>
                    {parent ? (
                      <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%", marginBottom: -2, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.slate }}>
                        <Text numberOfLines={1} style={{ fontSize: 11.5, color: colors.fog }}>
                          {parent.content ?? "Media"}
                        </Text>
                      </View>
                    ) : null}
                    {/* Received messages show the sender's avatar to the left (#7). */}
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7 }}>
                      {!mine ? <Avatar name={title} uri={profile.data?.avatar_url} size={26} /> : null}
                      <View style={{ flex: 1 }}>
                        {message.reply_story_media ? (
                          <StoryReplyPreview path={message.reply_story_media} mine={mine} />
                        ) : null}
                        {message.kind === "share" && message.shared_kind ? (
                          <ShareCard
                            mine={mine}
                            label={message.content ?? "Shared"}
                            sharedKind={message.shared_kind}
                            sharedId={message.shared_id}
                            onOpen={() => {
                              if (message.shared_kind === "post" && message.shared_id) router.push(`/post/${message.shared_id}`);
                              else if ((message.shared_kind === "checkin" || message.shared_kind === "stream") && message.shared_id) router.push(`/gym/${message.shared_id}`);
                            }}
                          />
                        ) : message.media_url ? (
                          <ChatMediaBubble path={message.media_url} mine={mine} />
                        ) : (
                          <MessageBubble mine={mine} text={message.content ?? ""} />
                        )}
                      </View>
                    </View>
                    {emojis.length ? (
                      <View style={{ alignSelf: mine ? "flex-end" : "flex-start", flexDirection: "row", gap: 3, marginTop: -2, marginBottom: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron }}>
                        {emojis.map((e) => (
                          <Text key={e} style={{ fontSize: 12 }}>{e}</Text>
                        ))}
                      </View>
                    ) : null}
                  </RNPressable>
                );
              })}
              {/* Delivery status under my most recent message (#5/#6):
                  "Delivered" until opened, then "Seen {t}". */}
              {lastMine && !lastMine.deleted_at ? (
                <Text style={{ alignSelf: "flex-end", paddingRight: 4, paddingTop: 2, fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: colors.fog }}>
                  {lastMineRead ? `Seen ${seenLabel}` : "Delivered"}
                </Text>
              ) : null}
            </>
          ) : conversation.isError ? (
            <View style={{ flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>
                COULDN&apos;T OPEN THIS CHAT
              </Text>
              <Pressable onPress={() => void conversation.refetch()} accessibilityRole="button">
                <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.white }}>
                  TRY AGAIN
                </Text>
              </Pressable>
            </View>
          ) : messages.isLoading || conversation.isLoading ? (
            <View style={{ flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>LOADING\u2026</Text>
            </View>
          ) : (
            // Empty thread after a friend-add: system-style prompt to start the DM.
            <View style={{ flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
              <View
                style={{
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 16,
                  paddingHorizontal: 22,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.iron,
                  backgroundColor: colors.graphite
                }}
              >
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white, textAlign: "center" }}>
                  {profile.data?.display_name ?? title} added you.
                </Text>
                <Text style={{ fontFamily: "Geist_400Regular", fontSize: 12.5, color: colors.silver, textAlign: "center" }}>
                  Start a message now.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={{ position: "relative", paddingHorizontal: 16, paddingTop: 10, paddingBottom: keyboardVisible ? 10 : insets.bottom + 14 }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -28,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.92)"
            }}
          />
          {/* Quote-reply preview (#10) */}
          {replyTo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: tokens.accent.gold }}>
              <CornerUpLeft size={14} color={colors.fog} strokeWidth={2} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: colors.silver }}>
                Replying to {replyTo.mine ? "yourself" : title}: {replyTo.text}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply" hitSlop={8}>
                <X size={16} color={colors.fog} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}
          <View
            style={{
              minHeight: 46,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: colors.iron,
              borderRadius: 999,
              backgroundColor: colors.graphite,
              paddingLeft: 16,
              paddingRight: 5,
              paddingVertical: 5
            }}
          >
            {!mock && sendReady ? (
              <Pressable onPress={() => void pickImage()} accessibilityLabel="Send a photo" hitSlop={6} disabled={sendMedia.isPending}>
                <ImagePlus size={20} color={sendMedia.isPending ? colors.iron : colors.silver} strokeWidth={2} />
              </Pressable>
            ) : null}
            {!mock && sendReady ? (
              <Pressable
                onPress={() => void toggleRecord()}
                accessibilityLabel={recording ? "Stop and send voice message" : "Record a voice message"}
                hitSlop={6}
              >
                {recording ? (
                  <Square size={18} color={colors.white} strokeWidth={2} fill={colors.white} />
                ) : (
                  <Mic size={20} color={colors.silver} strokeWidth={2} />
                )}
              </Pressable>
            ) : null}
            {recording ? (
              <Text style={{ flex: 1, paddingVertical: 7, fontFamily: "GeistMono_400Regular", fontSize: 13, color: colors.white }}>
                {`\u25cf Recording\u2026 0:${String(recordSecs).padStart(2, "0")}`}
              </Text>
            ) : (
              <TextInput
                value={draft}
                onChangeText={(v) => {
                  setDraft(v);
                  if (!mock) presence.notifyTyping();
                }}
                placeholder={isBlocked ? "You blocked this person" : `Message\u2026`}
                placeholderTextColor={colors.fog}
                editable={!isBlocked}
                returnKeyType="send"
                onSubmitEditing={send}
                style={{ flex: 1, paddingVertical: 7, fontSize: 14, color: colors.bone }}
              />
            )}
            <Pressable
              onPress={send}
              disabled={!draft.trim() || !sendReady || sendReal.isPending || recording}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: draft.trim() && !recording ? colors.white : colors.iron
                }}
              >
                <Send color={draft.trim() && !recording ? colors.black : colors.fog} size={16} strokeWidth={2.2} />
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* iMessage-style reaction + action menu (long-press on a message). */}
      <MessageActionMenu
        visible={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        onReact={(emoji) => {
          if (actionTarget) react.mutate({ messageId: actionTarget.message.id, emoji });
        }}
        actions={actionMenuItems()}
      />
    </View>
  );
}
