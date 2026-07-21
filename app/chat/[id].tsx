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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ImagePlus, Mic, Pause, Play, Send, Square } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { MessageBubble, TimeSeparator } from "@/components/friends/ChatBubbles";
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
  useSendMessage
} from "@/hooks/queries/useMessages";
import { useProfileById } from "@/hooks/queries/useProfile";
import { signedMessageUrl } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
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
function ChatMediaBubble({ path, mine }: { path: string; mine: boolean }) {
  const media = useQuery({
    queryKey: ["msg-media", path],
    staleTime: 50 * 60_000,
    queryFn: () => signedMessageUrl(path)
  });
  if (path.toLowerCase().endsWith(".m4a")) {
    return <AudioBubble uri={media.data ?? null} mine={mine} />;
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

  const profile = useProfileById(realProfileId);
  const conversation = useConversation(realProfileId);
  const conversationId = conversation.data ?? null;
  const messages = useMessages(conversationId);
  const sendReal = useSendMessage(conversationId);
  const sendMedia = useSendMediaMessage(conversationId);

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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      sendMedia.mutate(
        { localUri: result.assets[0].uri, kind: "image" },
        { onSuccess: inboxActions.invalidate, onError: () => showToast("Couldn't send the photo") }
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

  // Read receipt: my last sent message, and whether the other person opened it.
  const lastMine = useMemo(
    () => [...realItems].reverse().find((m) => m.sender_id === userId),
    [realItems, userId]
  );
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
    if (mock && id) {
      sendMock(id, text);
    } else {
      sendReal.mutate(text, { onSuccess: inboxActions.invalidate });
    }
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
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
            {sub ? (
              <Text numberOfLines={1} style={{ marginTop: 1, fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.fog }}>
                {sub}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          ) : realItems.length ? (
            <>
              <TimeSeparator label="Today" />
              {realItems.map((message) =>
                message.media_url ? (
                  <ChatMediaBubble key={message.id} path={message.media_url} mine={message.sender_id === userId} />
                ) : (
                  <MessageBubble key={message.id} mine={message.sender_id === userId} text={message.content ?? ""} />
                )
              )}
              {/* Read receipt under my most recent message once it's opened. */}
              {lastMineRead ? (
                <Text style={{ alignSelf: "flex-end", paddingRight: 4, paddingTop: 2, fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: colors.fog }}>
                  {`Seen ${seenLabel}`}
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
                onChangeText={setDraft}
                placeholder={`Message\u2026`}
                placeholderTextColor={colors.fog}
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
    </View>
  );
}
