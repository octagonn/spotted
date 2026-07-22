import { useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Eye, Flag, Heart, MoreHorizontal, Music, Plus, Send, Trash2, Users, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
import { REPORT_REASONS, useDeleteStory, useReportContent } from "@/hooks/queries/useContentModeration";
import { useStoryViewers } from "@/hooks/queries/useStoryViewers";
import { useStoryLiked, useStoryLikers, useToggleStoryLike } from "@/hooks/queries/useStoryLikes";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/** How long each story auto-plays, ms. */
const STORY_MS = 5000;
const TICK_MS = 50;

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

/** Resolve (or lazily create) the DM conversation, then send a message. */
async function replyToStory(userId: string, otherId: string, content: string, storyMedia?: string | null): Promise<boolean> {
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
    content,
    reply_story_media: storyMedia ?? null
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
  // Inline overlays (a fullScreenModal renders above the global sheet host, so
  // options/viewers/report are local overlays rather than useSheet).
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const deleteStory = useDeleteStory();
  const reportContent = useReportContent();

  const barFill = useSharedValue(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const replyInputRef = useRef<TextInput>(null);
  pausedRef.current = held || typing;

  // Finger-tracked horizontal paging between PEOPLE (Instagram-style): the whole
  // card follows the finger while the neighbor's story peeks in, then snaps to
  // the target and commits. `canPrev`/`canNext` gate the rubber-band at the ends.
  const { width: screenW } = useWindowDimensions();
  const panX = useSharedValue(0);
  const canPrev = useSharedValue(0);
  const canNext = useSharedValue(0);
  const paging = useSharedValue(0); // 1 while a horizontal pan is active (pauses timer)

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

  // Latest nav state in a ref so the swipe gestures can be created ONCE and
  // read current values — recreating gestures every render (the old approach)
  // tore down + rebuilt the handlers mid-swipe, which is what made
  // person-to-person swiping janky and could crash.
  const navRef = useRef({ queue, gi, group });
  navRef.current = { queue, gi, group };

  // Neighbor media for the peek during a horizontal drag. Next = the next
  // person's first UNSEEN story (matches goNextPerson); prev = the previous
  // person's first story (matches goPrevPerson).
  const nextGroup = queue?.[gi + 1];
  const nextPeekMedia = nextGroup
    ? nextGroup.stories[Math.max(0, nextGroup.stories.findIndex((s) => !s.seen))]?.mediaUrl ??
      nextGroup.stories[0]?.mediaUrl ??
      null
    : null;
  const prevPeekMedia = queue?.[gi - 1]?.stories[0]?.mediaUrl ?? null;

  // Keep the UI-thread bounds in sync so the pan can rubber-band at the ends.
  useEffect(() => {
    canPrev.value = gi > 0 ? 1 : 0;
    canNext.value = queue && gi < queue.length - 1 ? 1 : 0;
  }, [gi, queue, canPrev, canNext]);
  const viewers = useStoryViewers(story?.id, Boolean(group?.isMe) && viewersOpen);
  const likers = useStoryLikers(story?.id, Boolean(group?.isMe) && viewersOpen);
  const liked = useStoryLiked(!group?.isMe ? story?.id ?? null : null);
  const toggleLike = useToggleStoryLike();

  // No blank flash on open (4a): show a spinner until the media decodes, and
  // prefetch the next segment + the next person's first story ahead of time.
  const [mediaLoaded, setMediaLoaded] = useState(false);
  useEffect(() => {
    setMediaLoaded(false);
  }, [story?.id]);
  useEffect(() => {
    if (!queue) return;
    const g = queue[gi];
    const urls: string[] = [];
    const nextInGroup = g?.stories[si + 1]?.mediaUrl;
    if (nextInGroup) urls.push(nextInGroup);
    const nextPersonFirst = queue[gi + 1]?.stories[0]?.mediaUrl;
    if (nextPersonFirst) urls.push(nextPersonFirst);
    for (const u of urls) void Image.prefetch(u);
  }, [queue, gi, si]);

  // Any open overlay pauses the story; closing them all resumes it.
  const closeOverlays = () => {
    setMenuOpen(false);
    setViewersOpen(false);
    setReportOpen(false);
    setHeld(false);
  };

  // Guard against rapid double-fire (swiping past the end fired router.back()
  // several times → popped past the story screen → crash).
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/feed");
  }, [router]);

  const goNext = useCallback(() => {
    if (!queue) return;
    const g = queue[gi];
    if (g && si < g.stories.length - 1) {
      setSi(si + 1);
      return;
    }
    // End of this person: advance to the next group that still has UNSEEN
    // content. If none remains, EXIT rather than replaying already-viewed
    // stories (4c — the auto-advance chain stops at the boundary of new content).
    let ni = gi + 1;
    while (ni < queue.length && !queue[ni].stories.some((s) => !s.seen)) ni += 1;
    if (ni < queue.length) {
      setGi(ni);
      const firstUnseen = queue[ni].stories.findIndex((s) => !s.seen);
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
      if (pausedRef.current || paging.value > 0) return;
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
  // finger with a slight shrink, then flies off or springs back. The gesture
  // itself is composed in the useMemo below.
  const dragY = useSharedValue(0);
  // Swipe = jump to the next/previous PERSON's ring (4d). Stable identity (reads
  // nav state from the ref) so the gestures below never need to be rebuilt.
  const goNextPerson = useCallback(() => {
    const { queue: q, gi: g } = navRef.current;
    if (!q) return;
    if (g < q.length - 1) {
      const next = q[g + 1];
      const fu = next.stories.findIndex((s) => !s.seen);
      setGi(g + 1);
      setSi(fu >= 0 ? fu : 0);
    } else {
      close();
    }
  }, [close]);
  const goPrevPerson = useCallback(() => {
    const { gi: g } = navRef.current;
    if (g > 0) {
      setGi(g - 1);
      setSi(0);
    } else {
      setSi(0);
    }
  }, []);

  // Commit a page change AFTER the snap animation has moved the card fully to
  // the neighbor — then reset panX so the (identical) new center shows with no
  // flash. Both happen in the same JS turn.
  const commitNext = useCallback(() => {
    goNextPerson();
    panX.value = 0;
  }, [goNextPerson, panX]);
  const commitPrev = useCallback(() => {
    goPrevPerson();
    panX.value = 0;
  }, [goPrevPerson, panX]);

  // Swipe up: on someone else's story → reply keyboard; on YOUR OWN → viewer
  // sheet (4e). Stable (reads group from the ref).
  const swipeUpAction = useCallback(() => {
    const { group: gr } = navRef.current;
    if (!gr) return;
    if (gr.isMe) {
      setHeld(true);
      setViewersOpen(true);
    } else {
      replyInputRef.current?.focus();
    }
  }, []);

  // Build the composed gesture exactly ONCE (all callbacks + shared values are
  // stable). GestureDetector then keeps the same handler across renders, so a
  // re-render mid-swipe never interrupts the pan.
  const storyGesture = useMemo(() => {
    const SNAP = { damping: 22, stiffness: 220 } as const;
    // Horizontal paging — the card tracks the finger 1:1, rubber-banding when
    // there's no neighbor in that direction, and snaps to the target on release.
    const pageG = Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-16, 16])
      .onStart(() => {
        paging.value = 1;
      })
      .onUpdate((e) => {
        "worklet";
        let x = e.translationX;
        // Rubber-band past the ends (no next/prev to reveal).
        if (x < 0 && canNext.value === 0) x *= 0.25;
        if (x > 0 && canPrev.value === 0) x *= 0.25;
        panX.value = x;
      })
      .onEnd((e) => {
        "worklet";
        const goNextSwipe = (e.translationX < -80 || e.velocityX < -650) && canNext.value === 1;
        const goPrevSwipe = (e.translationX > 80 || e.velocityX > 650) && canPrev.value === 1;
        if (goNextSwipe) {
          panX.value = withTiming(-screenW, { duration: 190 }, (done) => {
            if (done) {
              paging.value = 0;
              runOnJS(commitNext)();
            }
          });
        } else if (goPrevSwipe) {
          panX.value = withTiming(screenW, { duration: 190 }, (done) => {
            if (done) {
              paging.value = 0;
              runOnJS(commitPrev)();
            }
          });
        } else {
          panX.value = withSpring(0, SNAP);
          paging.value = 0;
        }
      });
    const swipeDownG = Gesture.Pan()
      .activeOffsetY(16)
      .failOffsetY(-16)
      .failOffsetX([-20, 20])
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
    const swipeUpG = Gesture.Pan()
      .activeOffsetY(-18)
      .failOffsetY(18)
      .failOffsetX([-20, 20])
      .onEnd((e) => {
        if (e.translationY < -60 || e.velocityY < -700) runOnJS(swipeUpAction)();
      });
    // Race: whichever direction activates first wins the touch.
    return Gesture.Race(pageG, swipeDownG, swipeUpG);
  }, [close, commitNext, commitPrev, swipeUpAction, dragY, panX, paging, canNext, canPrev, screenW]);

  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: panX.value }] }));

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
    const ok = await replyToStory(userId, group.userId, text, story?.mediaPath ?? null);
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
      {/* Paging layer — the current card + its two neighbor peeks translate
          together with the finger; the neighbor images sit exactly one screen
          width to each side so a drag reveals them seamlessly. */}
      <Animated.View style={[{ flex: 1 }, pageStyle]}>
        {prevPeekMedia ? (
          <Image
            source={{ uri: prevPeekMedia }}
            contentFit="contain"
            cachePolicy="memory-disk"
            style={{ position: "absolute", top: 0, bottom: 0, left: -screenW, width: screenW, backgroundColor: colors.black }}
          />
        ) : null}
        {nextPeekMedia ? (
          <Image
            source={{ uri: nextPeekMedia }}
            contentFit="contain"
            cachePolicy="memory-disk"
            style={{ position: "absolute", top: 0, bottom: 0, left: screenW, width: screenW, backgroundColor: colors.black }}
          />
        ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.black }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Spinner behind the media so opening a story never flashes blank. */}
        {story.mediaUrl && !mediaLoaded ? (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="rgba(255,255,255,0.7)" />
          </View>
        ) : null}
        {story.mediaUrl ? (
          <Image
            source={{ uri: story.mediaUrl }}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
            priority="high"
            onLoad={() => setMediaLoaded(true)}
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
          <Pressable
            onPress={() => {
              setHeld(true);
              setMenuOpen(true);
            }}
            hitSlop={12}
            accessibilityLabel="Story options"
            style={{ paddingHorizontal: 4 }}
          >
            <MoreHorizontal color={colors.white} size={24} strokeWidth={2.2} />
          </Pressable>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close stories">
            <X color={colors.white} size={24} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Tagged friends — tappable chips that open each profile (consistent with posts). */}
        {story.tags.length ? (
          <View
            style={{
              position: "absolute",
              left: 14,
              bottom: insets.bottom + (group.isMe ? 58 : 82) + (story.music ? 40 : 0),
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              maxWidth: "80%",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.55)"
            }}
          >
            <Users size={13} color={colors.white} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>with</Text>
            {story.tags.map((tag) => (
              <Pressable
                key={tag.userId}
                onPress={() => {
                  close();
                  router.push(`/user/${tag.username}`);
                }}
                accessibilityLabel={`Open @${tag.username}'s profile`}
              >
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 12, color: colors.white }}>
                  @{tag.username}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
          <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 0, right: 0, alignItems: "center", gap: 12 }}>
            <Pressable
              onPress={() => {
                setHeld(true);
                setViewersOpen(true);
              }}
              accessibilityLabel="See who viewed your story"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Eye size={16} color={colors.white} strokeWidth={2} />
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }}>
                  Seen by
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                close();
                router.push("/camera?mode=story");
              }}
              accessibilityLabel="Add another story"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: colors.white }}>
                <Plus size={17} color={colors.black} strokeWidth={2.6} />
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Add to story</Text>
              </View>
            </Pressable>
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
            ) : (
              <Pressable
                onPress={() => {
                  if (story?.id) toggleLike.mutate({ storyId: story.id, like: !liked.data });
                }}
                accessibilityLabel={liked.data ? "Unlike story" : "Like story"}
                hitSlop={8}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
              >
                <Heart
                  size={26}
                  color={liked.data ? tokens.accent.gold : colors.white}
                  fill={liked.data ? tokens.accent.gold : "transparent"}
                  strokeWidth={2}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* Options menu (⋯) — Delete on your own story, Report on others'. */}
        {menuOpen ? (
          <Pressable onPress={closeOverlays} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }]}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.ink, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.iron, paddingBottom: insets.bottom + 12 }}>
              <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate }} />
              </View>
              {group.isMe ? (
                <OverlayRow
                  icon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />}
                  label="Delete story"
                  destructive
                  onPress={() => {
                    setMenuOpen(false);
                    deleteStory.mutate(
                      { storyId: story.id, mediaPath: null },
                      {
                        onSuccess: () => {
                          showToast("Story deleted");
                          close();
                        },
                        onError: () => showToast("Couldn't delete — try again")
                      }
                    );
                  }}
                />
              ) : (
                <OverlayRow
                  icon={<Flag size={18} color={colors.silver} strokeWidth={2} />}
                  label="Report story"
                  onPress={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                />
              )}
              <OverlayRow icon={null} label="Cancel" onPress={closeOverlays} />
            </Pressable>
          </Pressable>
        ) : null}

        {/* Report reasons */}
        {reportOpen ? (
          <Pressable onPress={closeOverlays} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }]}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.ink, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.iron, paddingBottom: insets.bottom + 12 }}>
              <Text style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10, fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white }}>
                Report story
              </Text>
              {REPORT_REASONS.map((r) => (
                <OverlayRow
                  key={r}
                  icon={null}
                  label={r}
                  onPress={() => {
                    reportContent.mutate(
                      { contentType: "story", contentId: story.id, reportedUserId: group.userId, reason: r },
                      {
                        onSuccess: () => {
                          closeOverlays();
                          showToast("Thanks — we'll review this.");
                        },
                        onError: () => showToast("Couldn't submit — try again")
                      }
                    );
                  }}
                />
              ))}
              <OverlayRow icon={null} label="Cancel" onPress={closeOverlays} />
            </Pressable>
          </Pressable>
        ) : null}

        {/* Seen-by viewers list (own story) */}
        {viewersOpen ? (
          <Pressable onPress={closeOverlays} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }]}>
            <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: "70%", backgroundColor: colors.ink, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.iron, paddingBottom: insets.bottom + 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 }}>
                <Eye size={17} color={colors.white} strokeWidth={2} />
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white }}>
                  {`Seen by ${viewers.data?.length ?? 0}`}
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 360 }}>
                {viewers.isLoading ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <ActivityIndicator color={colors.mist} />
                  </View>
                ) : (viewers.data ?? []).length === 0 ? (
                  <Text style={{ paddingHorizontal: 20, paddingVertical: 16, fontSize: 12.5, color: colors.fog }}>
                    No views yet.
                  </Text>
                ) : (
                  (viewers.data ?? []).map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => {
                        close();
                        router.push(`/user/${v.username}`);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 9 }}
                    >
                      <Avatar name={v.display_name} uri={v.avatar_url} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>{v.display_name}</Text>
                        <Text style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>@{v.username}</Text>
                      </View>
                      {likers.data?.has(v.id) ? (
                        <Heart size={16} color={tokens.accent.gold} fill={tokens.accent.gold} strokeWidth={2} />
                      ) : null}
                      <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.fog }}>{timeAgo(v.viewedAt)}</Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
      </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function OverlayRow({
  icon,
  label,
  destructive,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 15 }}>
        {icon ? <View style={{ width: 20, alignItems: "center" }}>{icon}</View> : <View style={{ width: 20 }} />}
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 15, color: destructive ? "#EF4444" : label === "Cancel" ? colors.fog : colors.white }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
