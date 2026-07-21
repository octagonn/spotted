import { useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Music, Send, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { useMarkStoryViewed, useStories, type StoryGroup } from "@/hooks/queries/useStories";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

/** How long each story auto-plays, ms. */
const STORY_MS = 5000;
const TICK_MS = 50;

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

/** Resolve (or lazily create) the DM conversation, then send a message. */
async function replyToStory(userId: string, otherId: string, content: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const [a, b] = [userId, otherId].sort();
  const findConversation = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("participant_a", a)
      .eq("participant_b", b)
      .maybeSingle();
    return data?.id ?? null;
  };
  let conversationId = await findConversation();
  if (!conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();
    conversationId = error ? await findConversation() : data?.id ?? null;
  }
  if (!conversationId) return false;
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: userId,
    content
  });
  return !error;
}

export default function StoryViewer() {
  const { user } = useLocalSearchParams<{ user?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stories = useStories();
  const groups = stories.data;
  const markViewed = useMarkStoryViewed();
  const userId = useAuthStore((state) => state.userId);

  // Snapshot the queue at open so a live refetch (from marking stories seen)
  // can't reorder groups mid-view and make the viewer jump.
  const [queue, setQueue] = useState<StoryGroup[] | null>(null);
  const [gi, setGi] = useState(0);
  const [si, setSi] = useState(0);
  const [held, setHeld] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const barFill = useSharedValue(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const replyInputRef = useRef<TextInput>(null);
  pausedRef.current = held || typing;

  // Pick the starting group + first UNVIEWED story once, when stories load.
  useEffect(() => {
    if (queue || !groups) return;
    if (groups.length === 0) {
      router.back();
      return;
    }
    const gIdx = Math.max(0, groups.findIndex((g) => g.userId === user));
    const g = groups[gIdx];
    const firstUnseen = g ? g.stories.findIndex((s) => !s.seen) : -1;
    setQueue(groups);
    setGi(gIdx);
    setSi(firstUnseen >= 0 ? firstUnseen : 0);
  }, [groups, queue, router, user]);

  const group: StoryGroup | undefined = queue?.[gi];
  const story = group?.stories[si];

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/feed");
  }, [router]);

  const goNext = useCallback(() => {
    if (!queue) return;
    const g = queue[gi];
    if (g && si < g.stories.length - 1) {
      setSi(si + 1);
    } else if (gi < queue.length - 1) {
      setGi(gi + 1);
      // Land on the first unseen story of the next group.
      const next = queue[gi + 1];
      const firstUnseen = next ? next.stories.findIndex((s) => !s.seen) : -1;
      setSi(firstUnseen >= 0 ? firstUnseen : 0);
    } else {
      close();
    }
  }, [queue, gi, si, close]);

  const goPrev = useCallback(() => {
    if (si > 0) {
      setSi(si - 1);
    } else if (gi > 0) {
      const prev = queue?.[gi - 1];
      setGi(gi - 1);
      setSi(prev ? prev.stories.length - 1 : 0);
    } else {
      setSi(0);
    }
  }, [queue, gi, si]);

  // Drive the progress timer for the current story. A per-story guard makes the
  // auto-advance fire exactly once (no double-advances), and the effect cleanup
  // clears the interval on every story change (no stuck bars).
  useEffect(() => {
    if (!queue || !story) return;
    const currentId = story.id;
    let advanced = false;
    elapsedRef.current = 0;
    barFill.value = 0;
    if (group && !group.isMe) {
      markViewed.mutate(currentId);
    }
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += TICK_MS;
      barFill.value = Math.min(1, elapsedRef.current / STORY_MS);
      if (elapsedRef.current >= STORY_MS && !advanced) {
        advanced = true;
        clearInterval(timer);
        goNext();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
    // Keyed on the story identity; goNext/markViewed are intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, gi, si]);

  const activeBarStyle = useAnimatedStyle(() => ({ width: `${barFill.value * 100}%` }));

  // Story music: the poster's chosen clip plays while their story is up,
  // pauses while held/typing, and swaps with the story.
  const music = story?.music ?? null;
  const audioPlayer = useAudioPlayer(music?.previewUrl ? { uri: music.previewUrl } : null);
  useEffect(() => {
    if (!music?.previewUrl) return;
    try {
      audioPlayer.seekTo(music.clipStart).catch(() => {});
      audioPlayer.play();
    } catch {
      // A torn-down player must never crash the viewer.
    }
    // Restart only when the story (and thus its clip) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);
  useEffect(() => {
    try {
      if (held || typing) audioPlayer.pause();
      else if (music?.previewUrl) audioPlayer.play();
    } catch {
      // Ignore audio-session hiccups.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, typing]);

  // Preload the neighboring stories so advancing is an instant cache hit
  // instead of showing the old frame, a cut, then a network load.
  useEffect(() => {
    if (!queue) return;
    const urls: string[] = [];
    const g = queue[gi];
    if (g) {
      const next = g.stories[si + 1];
      if (next?.mediaUrl) urls.push(next.mediaUrl);
      const prev = g.stories[si - 1];
      if (prev?.mediaUrl) urls.push(prev.mediaUrl);
    }
    const nextGroup = queue[gi + 1];
    if (nextGroup) {
      const idx = nextGroup.stories.findIndex((s) => !s.seen);
      const first = nextGroup.stories[idx >= 0 ? idx : 0];
      if (first?.mediaUrl) urls.push(first.mediaUrl);
    }
    if (urls.length) void Image.prefetch(urls);
  }, [queue, gi, si]);

  // Interactive swipe-down dismiss (Snapchat-style): the card follows the
  // finger with a slight shrink, then flies off or springs back.
  const dragY = useSharedValue(0);
  const swipeDown = Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetY(-14)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dragY.value > 130 || e.velocityY > 900) {
        dragY.value = withTiming(700, { duration: 170 });
        runOnJS(close)();
      } else {
        dragY.value = withSpring(0, { damping: 18, stiffness: 240 });
      }
    });
  // Swipe up (on someone else's story) opens the reply keyboard.
  const focusReply = () => {
    if (group && !group.isMe) replyInputRef.current?.focus();
  };
  const swipeUp = Gesture.Pan()
    .activeOffsetY(-16)
    .failOffsetY(16)
    .failOffsetX([-24, 24])
    .onEnd((e) => {
      if (e.translationY < -60 || e.velocityY < -700) {
        runOnJS(focusReply)();
      }
    });
  const storyGesture = Gesture.Exclusive(swipeDown, swipeUp);

  const dragStyle = useAnimatedStyle(() => {
    const p = Math.min(1, dragY.value / 420);
    return {
      transform: [{ translateY: dragY.value }, { scale: 1 - p * 0.08 }],
      borderRadius: p * 26
    };
  });

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || !group || group.isMe || !userId) return;
    setDraft("");
    Keyboard.dismiss();
    const ok = await replyToStory(userId, group.userId, `↩︎ Replied to your story: ${text}`);
    showToast(ok ? `Sent to ${group.name.split(" ")[0]}` : "Couldn't send reply");
  };

  if (!queue || !group || !story) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  return (
    <GestureDetector gesture={storyGesture}>
      <Animated.View style={[{ flex: 1, backgroundColor: colors.black, overflow: "hidden" }, dragStyle]}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.black }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {story.mediaUrl ? (
          <Image
            source={{ uri: story.mediaUrl }}
            contentFit="contain"
            transition={0}
            cachePolicy="memory-disk"
            priority="high"
            // Reuse one decoded surface across stories (no reload flash) and let
            // expo-image downscale big photos to the view — the main viewer cost.
            recyclingKey={story.id}
            allowDownscaling
            style={{ position: "absolute", inset: 0 }}
          />
        ) : null}

        {/* Tap zones: left third = prev, right two-thirds = next; hold = pause. */}
        <View style={{ position: "absolute", inset: 0, flexDirection: "row" }}>
          <Pressable
            style={{ width: "33%" }}
            onPress={goPrev}
            delayLongPress={180}
            onLongPress={() => setHeld(true)}
            onPressOut={() => setHeld(false)}
          />
          <Pressable
            style={{ flex: 1 }}
            onPress={goNext}
            delayLongPress={180}
            onLongPress={() => setHeld(true)}
            onPressOut={() => setHeld(false)}
          />
        </View>

        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 110 }}
        />

        {/* Progress bars — one segment per story. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, flexDirection: "row", gap: 4 }}
        >
          {group.stories.map((s, index) => (
            <View
              key={s.id}
              style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" }}
            >
              {index < si ? (
                <View style={{ height: "100%", width: "100%", backgroundColor: colors.white }} />
              ) : index === si ? (
                <Animated.View style={[{ height: "100%", backgroundColor: colors.white }, activeBarStyle]} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header: poster + time + close */}
        <View
          style={{
            position: "absolute",
            top: insets.top + 20,
            left: 14,
            right: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10
          }}
        >
          <Pressable
            onPress={() => {
              if (group.isMe) return;
              router.push(`/user/${group.username}`);
            }}
            accessibilityLabel={`Open ${group.name}'s profile`}
            hitSlop={6}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Avatar name={group.name} uri={group.avatarUrl} size={34} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>{group.name}</Text>
          </Pressable>
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            {timeAgo(story.createdAt)}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close stories">
            <X color={colors.white} size={24} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Music chip — what's playing on this story. */}
        {story.music ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 14,
              bottom: insets.bottom + (group.isMe ? 58 : 82),
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 6,
              paddingLeft: 6,
              paddingRight: 12,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.55)"
            }}
          >
            {story.music.artworkUrl ? (
              <Image source={{ uri: story.music.artworkUrl }} style={{ width: 22, height: 22, borderRadius: 6 }} contentFit="cover" />
            ) : (
              <Music size={14} color={colors.white} strokeWidth={2} />
            )}
            <Text numberOfLines={1} style={{ maxWidth: 220, fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.white }}>
              {story.music.title} · {story.music.artist}
            </Text>
          </View>
        ) : null}

        {group.isMe ? (
          <View style={{ position: "absolute", bottom: insets.bottom + 24, left: 0, right: 0, alignItems: "center" }} pointerEvents="none">
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1, color: "rgba(255,255,255,0.7)" }}>
              YOUR STORY · VISIBLE TO FRIENDS FOR 24H
            </Text>
          </View>
        ) : (
          // Reply field — sends a DM to the poster referencing this story.
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 14,
              paddingBottom: typing ? 10 : insets.bottom + 12,
              paddingTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 10
            }}
          >
            <TextInput
              ref={replyInputRef}
              value={draft}
              onChangeText={setDraft}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onSubmitEditing={() => void sendReply()}
              placeholder={`Reply to ${group.name.split(" ")[0]}…`}
              placeholderTextColor="rgba(255,255,255,0.6)"
              returnKeyType="send"
              style={{
                flex: 1,
                minHeight: 44,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.4)",
                borderRadius: 999,
                paddingHorizontal: 18,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.white,
                fontFamily: "Geist_400Regular"
              }}
            />
            {draft.trim().length > 0 ? (
              <Pressable
                onPress={() => void sendReply()}
                accessibilityLabel="Send reply"
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}
              >
                <Send size={18} color={colors.black} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>
      </Animated.View>
    </GestureDetector>
  );
}
