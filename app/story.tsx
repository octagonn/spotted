import { useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Flag, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StoryOwnerBar, StoryReplyBar } from "@/components/story/StoryBars";
import { MusicChipOverlay, STORY_CHIP_STACK, TagsChip, ViewPostChip } from "@/components/story/StoryChips";
import { StoryHeader } from "@/components/story/StoryHeader";
import { StoryOverlay } from "@/components/story/StoryOverlay";
import { StoryViewersList } from "@/components/story/StoryViewersList";
import { MenuRow } from "@/components/ui/MenuRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { REPORT_REASONS, useDeleteStory, useReportContent } from "@/hooks/queries/useContentModeration";
import { useMarkStoryViewed, useStories, type StoryGroup } from "@/hooks/queries/useStories";
import { useStoryLiked, useStoryLikers, useToggleStoryLike } from "@/hooks/queries/useStoryLikes";
import { useStoryViewers } from "@/hooks/queries/useStoryViewers";
import { useKeyboardHeight } from "@/hooks/useKeyboardVisible";
import { timeAgo } from "@/lib/notificationCopy";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

/** How long each story auto-plays, ms. */
const STORY_MS = 5000;
/** Left inset for the chip stack. */
const CHIP_LEFT = space[3] + 2;

/** Resolve (or lazily create) the DM conversation, then send a message. */
async function replyToStory(
  userId: string,
  otherId: string,
  content: string,
  storyMedia?: string | null
): Promise<boolean> {
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
    conversationId = error ? await findConversation() : (data?.id ?? null);
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

/**
 * Story viewer (fullScreenModal). Media first: the photo fills the screen and
 * every piece of chrome fades on hold. Timer, pager and gestures live on the
 * UI thread; overlays are local (the modal renders above the global sheet host).
 */
export default function StoryViewer() {
  const { user, ps } = useLocalSearchParams<{ user?: string; ps?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
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
  // Hold-to-fullscreen: while the long-press pause is active FROM THE TAP
  // ZONES, all chrome fades out so the photo stands alone. Separate from
  // `held` because the viewers sheet also sets held.
  const [immersed, setImmersed] = useState(false);
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
  const pausedRef = useRef(false);
  const replyInputRef = useRef<TextInput>(null);
  pausedRef.current = held || typing;

  // Finger-tracked horizontal paging between PEOPLE: the whole card follows
  // the finger while the neighbor's story peeks in, then snaps and commits.
  const { width: screenW } = useWindowDimensions();
  const panX = useSharedValue(0);
  // UI-thread mirror of `gi`. The pager translates by (-giSV * width + panX),
  // and a swipe commit updates giSV and panX IN ONE WORKLET so the on-screen
  // frame is arithmetically unchanged.
  const giSV = useSharedValue(0);
  // 1 between the UI-thread commit and React catching up — pans are ignored.
  const settling = useSharedValue(0);
  const canPrev = useSharedValue(0);
  const canNext = useSharedValue(0);
  const paging = useSharedValue(0); // 1 while a horizontal pan is active (pauses timer)
  // 1 while an overlay (menu / viewers / report / reply keyboard) is up. The
  // root gestures ignore touches then.
  const overlayBlock = useSharedValue(0);

  // Pick the starting group + first UNVIEWED story once, when stories load.
  useEffect(() => {
    if (queue || !groups) return;
    if (groups.length === 0) {
      router.back();
      return;
    }
    const gIdx = Math.max(
      0,
      groups.findIndex((g) => g.userId === user && (ps ? g.privateStoryId === ps : !g.privateStoryId))
    );
    const g = groups[gIdx];
    const firstUnseen = g ? g.stories.findIndex((s) => !s.seen) : -1;
    setQueue(groups);
    setGi(gIdx);
    setSi(firstUnseen >= 0 ? firstUnseen : 0);
  }, [groups, queue, router, user, ps]);

  const group: StoryGroup | undefined = queue?.[gi];
  const story = group?.stories[si];

  // Latest nav state in a ref so the swipe gestures can be created ONCE and
  // read current values — recreating gestures every render tore down + rebuilt
  // the handlers mid-swipe.
  const navRef = useRef({ queue, gi, group });
  navRef.current = { queue, gi, group };

  // Underlay pages for the pager, positioned at ABSOLUTE index * width and
  // keyed by absolute index, so the visible photo is never remounted.
  const pagerPages = useMemo(() => {
    if (!queue) return [] as { idx: number; uri: string }[];
    const out: { idx: number; uri: string }[] = [];
    for (const idx of [gi - 1, gi, gi + 1]) {
      const g = queue[idx];
      if (!g) continue;
      let uri: string | null | undefined;
      if (idx === gi) uri = g.stories[si]?.mediaUrl;
      else if (idx < gi) uri = g.stories[0]?.mediaUrl;
      else {
        const fu = g.stories.findIndex((st) => !st.seen);
        uri = g.stories[fu >= 0 ? fu : 0]?.mediaUrl;
      }
      if (uri) out.push({ idx, uri });
    }
    return out;
  }, [queue, gi, si]);

  useEffect(() => {
    overlayBlock.value = menuOpen || viewersOpen || reportOpen || typing ? 1 : 0;
  }, [menuOpen, viewersOpen, reportOpen, typing, overlayBlock]);
  const viewers = useStoryViewers(story?.id, Boolean(group?.isMe));
  const likers = useStoryLikers(story?.id, Boolean(group?.isMe) && viewersOpen);
  const liked = useStoryLiked(!group?.isMe ? (story?.id ?? null) : null);
  const toggleLike = useToggleStoryLike();

  // No blank flash on open: show a skeleton until the media decodes.
  const [mediaLoaded, setMediaLoaded] = useState(false);
  useEffect(() => {
    setMediaLoaded(false);
  }, [story?.id]);

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
    // content. If none remains, EXIT rather than replaying viewed stories.
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

  // Smooth progress: ONE UI-thread linear timing drives the bar for the whole
  // story. Pausing cancels the animation (the value freezes in place);
  // resuming re-times just the remainder.
  const advancedRef = useRef(false);

  const autoAdvance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    // End of the LAST story: park with the bar full instead of closing —
    // closing is the user's move (tap past the end, swipe down, or the X).
    const atEnd = Boolean(queue && gi === queue.length - 1 && group && si === group.stories.length - 1);
    if (atEnd) return;
    goNext();
  }, [goNext, queue, gi, si, group]);

  const startBar = useCallback(() => {
    if (pausedRef.current || advancedRef.current) return;
    const remaining = Math.max(16, (1 - barFill.value) * STORY_MS);
    // ReduceMotion.Never is CRITICAL here: this timing IS the story timer, not
    // a decorative animation. With the system Reduce Motion setting on,
    // Reanimated completes animations instantly — which auto-advanced through
    // every story in one frame and closed the viewer the moment it opened.
    barFill.value = withTiming(
      1,
      { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never },
      (finished) => {
        if (finished) runOnJS(autoAdvance)();
      }
    );
  }, [autoAdvance, barFill]);

  // Per-story reset: new story → fresh bar, single-fire advance guard.
  useEffect(() => {
    if (!queue || !story) return;
    advancedRef.current = false;
    cancelAnimation(barFill);
    barFill.value = 0;
    if (group && !group.isMe) {
      markViewed.mutate(story.id);
    }
    startBar();
    return () => cancelAnimation(barFill);
    // Keyed on the story identity; startBar/markViewed are intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, gi, si]);

  // Hold / typing pause-resume.
  useEffect(() => {
    if (!story) return;
    if (held || typing) cancelAnimation(barFill);
    else startBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, typing]);

  // Page-swipe pause-resume (paging lives on the UI thread).
  useAnimatedReaction(
    () => paging.value > 0,
    (isPaging, prev) => {
      if (isPaging) cancelAnimation(barFill);
      else if (prev) runOnJS(startBar)();
    },
    [startBar]
  );

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

  // Preload the neighboring stories so advancing is an instant cache hit.
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

  // Interactive swipe-down dismiss: the card follows the finger with a slight
  // shrink, then flies off or springs back.
  const dragY = useSharedValue(0);
  // Pinch-to-zoom (transient): scale about the focal point, spring back on release.
  const pinchScale = useSharedValue(1);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  // Swipe = jump to the next/previous PERSON's ring. Stable identity (reads
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
      // If a commit ever lands at the first group, undo the worklet's
      // speculative shift so the pager can't wedge on a bailed-out render.
      giSV.value = g;
      panX.value = 0;
      settling.value = 0;
      setSi(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitNext = useCallback(() => {
    goNextPerson();
  }, [goNextPerson]);
  const commitPrev = useCallback(() => {
    goPrevPerson();
  }, [goPrevPerson]);
  // React caught up with a commit (or gi changed via tap): sync the UI-thread
  // mirror, the swipe bounds AND release the settle guard in ONE synchronous
  // pass. Bounds must never lag the release (layout effect, not passive).
  useLayoutEffect(() => {
    giSV.value = gi;
    canPrev.value = gi > 0 ? 1 : 0;
    canNext.value = queue && gi < queue.length - 1 ? 1 : 0;
    settling.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, queue]);

  // Swipe up: on someone else's story → reply keyboard; on YOUR OWN → viewers.
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
  // stable), so a re-render mid-swipe never interrupts the pan.
  const storyGesture = useMemo(() => {
    // Page snaps carry the finger's release VELOCITY into a clamped spring.
    const SNAP_SPRING = {
      damping: 34,
      stiffness: 270,
      mass: 0.8,
      overshootClamping: true,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 1
    } as const;
    const pageG = Gesture.Pan()
      .activeOffsetX([-10, 10])
      // Must bow out BEFORE either vertical gesture activates (up: 18, down: 16).
      .failOffsetY([-14, 14])
      .onStart(() => {
        "worklet";
        if (settling.value === 1 || overlayBlock.value === 1) return;
        paging.value = 1;
      })
      .onUpdate((e) => {
        "worklet";
        if (settling.value === 1 || overlayBlock.value === 1) return;
        let x = e.translationX;
        // Rubber-band past the ends (no next/prev to reveal).
        if (x < 0 && canNext.value === 0) x *= 0.25;
        if (x > 0 && canPrev.value === 0) x *= 0.25;
        panX.value = x;
      })
      .onEnd((e) => {
        "worklet";
        if (settling.value === 1 || overlayBlock.value === 1) return;
        const turnDistance = screenW * 0.25;
        const goNextSwipe = (e.translationX < -turnDistance || e.velocityX < -500) && canNext.value === 1;
        const goPrevSwipe = (e.translationX > turnDistance || e.velocityX > 500) && canPrev.value === 1;
        if (goNextSwipe) {
          settling.value = 1;
          panX.value = withSpring(-screenW, { ...SNAP_SPRING, velocity: e.velocityX }, (done) => {
            "worklet";
            // A tap-advance mid-settle clears `settling` — bail instead of double-advancing.
            if (done && settling.value === 1) {
              // ATOMIC handoff: giSV+1 and panX->0 change translation by
              // (-W + W) = 0 in one UI-thread batch — the frame is pixel-identical.
              giSV.value = giSV.value + 1;
              panX.value = 0;
              paging.value = 0;
              runOnJS(commitNext)();
            } else {
              settling.value = 0;
              paging.value = 0;
            }
          });
        } else if (goPrevSwipe) {
          settling.value = 1;
          panX.value = withSpring(screenW, { ...SNAP_SPRING, velocity: e.velocityX }, (done) => {
            "worklet";
            if (done && settling.value === 1) {
              giSV.value = giSV.value - 1;
              panX.value = 0;
              paging.value = 0;
              runOnJS(commitPrev)();
            } else {
              settling.value = 0;
              paging.value = 0;
            }
          });
        } else {
          panX.value = withSpring(0, { ...SNAP_SPRING, velocity: e.velocityX, damping: 28 });
          paging.value = 0;
        }
      });
    const swipeDownG = Gesture.Pan()
      .activeOffsetY(16)
      .failOffsetY(-16)
      .failOffsetX([-20, 20])
      .onUpdate((e) => {
        "worklet";
        if (overlayBlock.value === 1) return;
        dragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        "worklet";
        if (overlayBlock.value === 1) return;
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
        "worklet";
        if (overlayBlock.value === 1) return;
        if (e.translationY < -60 || e.velocityY < -700) runOnJS(swipeUpAction)();
      });
    // Pinch-to-zoom — two fingers, so it never fights the single-finger pans.
    const pinchG = Gesture.Pinch()
      .onStart((e) => {
        "worklet";
        paging.value = 1; // pause the story timer while zooming
        pinchFocalX.value = e.focalX;
        pinchFocalY.value = e.focalY;
      })
      .onUpdate((e) => {
        "worklet";
        pinchScale.value = Math.max(1, Math.min(4, e.scale));
      })
      .onEnd(() => {
        "worklet";
        pinchScale.value = withSpring(1, { damping: 20, stiffness: 220 });
        paging.value = 0;
      });
    // Race the one-finger directions; pinch runs alongside (two fingers).
    return Gesture.Simultaneous(Gesture.Race(pageG, swipeDownG, swipeUpG), pinchG);
  }, [
    close,
    commitNext,
    commitPrev,
    swipeUpAction,
    dragY,
    panX,
    paging,
    canNext,
    canPrev,
    screenW,
    pinchScale,
    pinchFocalX,
    pinchFocalY,
    giSV,
    settling,
    overlayBlock
  ]);

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -giSV.value * screenW + panX.value }]
  }));

  // Scale about the pinch focal point: translate focal→origin, scale, undo.
  const zoomStyle = useAnimatedStyle(() => {
    const sc = pinchScale.value;
    return {
      transform: [
        { translateX: pinchFocalX.value },
        { translateY: pinchFocalY.value },
        { scale: sc },
        { translateX: -pinchFocalX.value },
        { translateY: -pinchFocalY.value }
      ]
    };
  });

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

  const openUser = (username: string) => {
    close();
    router.push(`/user/${username}`);
  };

  if (!queue || !group || !story) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <Skeleton width="100%" radius={0} style={{ flex: 1, height: undefined }} />
      </View>
    );
  }

  // Chip stack above the bottom bar: each present chip pushes the ones above it up.
  const chipBase = insets.bottom + (group.isMe ? 58 : 82);
  const musicOffset = story.music ? STORY_CHIP_STACK : 0;
  const tagsOffset = story.tags.length ? STORY_CHIP_STACK : 0;

  return (
    <GestureDetector gesture={storyGesture}>
      <Animated.View style={[{ flex: 1, backgroundColor: colors.black, overflow: "hidden" }, dragStyle]}>
        {/* Paging layer — the current card + its two neighbor peeks translate
            together with the finger. */}
        <Animated.View style={[{ flex: 1 }, pageStyle]}>
          {/* Underlay pages at ABSOLUTE index positions, keyed by index — the
              revealed page keeps its node across a commit. */}
          {pagerPages.map((pg) => (
            <Image
              key={"page-" + pg.idx}
              source={{ uri: pg.uri }}
              contentFit="contain"
              cachePolicy="memory-disk"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: pg.idx * screenW,
                width: screenW,
                backgroundColor: colors.black
              }}
            />
          ))}
          {/* Full story UI rides at the center page's absolute slot. */}
          <View style={{ position: "absolute", top: 0, bottom: 0, left: gi * screenW, width: screenW }}>
            {/* iOS: the reply bar is absolutely positioned, which KAV padding
                cannot move — StoryReplyBar pins itself to the keyboard instead. */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? undefined : "height"}>
              {story.mediaUrl && !mediaLoaded ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Skeleton width="100%" radius={0} style={{ position: "absolute", inset: 0, height: undefined }} />
                </View>
              ) : null}
              {story.mediaUrl ? (
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, zoomStyle]}>
                  <Image
                    source={{ uri: story.mediaUrl }}
                    contentFit="contain"
                    transition={150}
                    cachePolicy="memory-disk"
                    priority="high"
                    onLoad={() => setMediaLoaded(true)}
                    // Reuse one decoded surface across stories and let expo-image
                    // downscale big photos to the view — the main viewer cost.
                    recyclingKey={story.id}
                    allowDownscaling
                    style={{ flex: 1 }}
                  />
                </Animated.View>
              ) : null}

              {/* Tap zones: left third = prev, right two-thirds = next; hold = pause. */}
              <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
                <Pressable
                  style={{ width: "33%" }}
                  onPress={goPrev}
                  delayLongPress={180}
                  onLongPress={() => {
                    setHeld(true);
                    setImmersed(true);
                  }}
                  onPressOut={() => {
                    setHeld(false);
                    setImmersed(false);
                  }}
                />
                <Pressable
                  style={{ flex: 1 }}
                  onPress={goNext}
                  delayLongPress={180}
                  onLongPress={() => {
                    setHeld(true);
                    setImmersed(true);
                  }}
                  onPressOut={() => {
                    setHeld(false);
                    setImmersed(false);
                  }}
                />
              </View>

              <StoryHeader
                group={group}
                storyIndex={si}
                timeLabel={timeAgo(story.createdAt)}
                activeBarStyle={activeBarStyle}
                immersed={immersed}
                onOpenProfile={() => router.push(`/user/${group.username}`)}
                onOpenMenu={() => {
                  setHeld(true);
                  setMenuOpen(true);
                }}
                onClose={close}
              />

              {story.sharedPostId ? (
                <ViewPostChip
                  onPress={() => {
                    close();
                    router.push(`/post/${story.sharedPostId}`);
                  }}
                  style={{
                    position: "absolute",
                    left: CHIP_LEFT,
                    bottom: chipBase + musicOffset + tagsOffset,
                    opacity: immersed ? 0 : 1
                  }}
                />
              ) : null}
              {story.tags.length ? (
                <TagsChip
                  tags={story.tags}
                  onOpenUser={openUser}
                  style={{
                    position: "absolute",
                    left: CHIP_LEFT,
                    bottom: chipBase + musicOffset,
                    opacity: immersed ? 0 : 1
                  }}
                />
              ) : null}
              {story.music ? (
                <MusicChipOverlay
                  music={story.music}
                  style={{ position: "absolute", left: CHIP_LEFT, bottom: chipBase, opacity: immersed ? 0 : 1 }}
                />
              ) : null}

              {group.isMe ? (
                <StoryOwnerBar
                  seenCount={viewers.data?.length}
                  immersed={immersed}
                  onOpenViewers={() => {
                    setHeld(true);
                    setViewersOpen(true);
                  }}
                  onAdd={() => {
                    close();
                    router.push("/camera?mode=story");
                  }}
                />
              ) : (
                <StoryReplyBar
                  inputRef={replyInputRef}
                  draft={draft}
                  onChangeDraft={setDraft}
                  onSend={() => void sendReply()}
                  onFocus={() => setTyping(true)}
                  onBlur={() => setTyping(false)}
                  typing={typing}
                  keyboardHeight={keyboardHeight}
                  immersed={immersed}
                  firstName={group.name.split(" ")[0]}
                  liked={Boolean(liked.data)}
                  onToggleLike={() => {
                    if (story?.id) toggleLike.mutate({ storyId: story.id, like: !liked.data });
                  }}
                />
              )}

              {/* Options (⋯) — Delete on your own story, Report on others'. */}
              {menuOpen ? (
                <StoryOverlay onClose={closeOverlays}>
                  {group.isMe ? (
                    <MenuRow
                      icon={
                        <Trash2
                          size={icon.size.xs + 2}
                          color={tokens.status.danger}
                          strokeWidth={icon.stroke.regular}
                        />
                      }
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
                    <MenuRow
                      icon={<Flag size={icon.size.xs + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
                      label="Report story"
                      onPress={() => {
                        setMenuOpen(false);
                        setReportOpen(true);
                      }}
                    />
                  )}
                  <MenuRow icon={null} label="Cancel" onPress={closeOverlays} />
                </StoryOverlay>
              ) : null}

              {reportOpen ? (
                <StoryOverlay onClose={closeOverlays}>
                  <Text variant="subheading" className="px-5 pt-2 pb-2">
                    Report story
                  </Text>
                  {REPORT_REASONS.map((r) => (
                    <MenuRow
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
                  <MenuRow icon={null} label="Cancel" onPress={closeOverlays} />
                </StoryOverlay>
              ) : null}

              {viewersOpen ? (
                <StoryOverlay onClose={closeOverlays} maxHeight="70%">
                  <StoryViewersList
                    viewers={viewers.data ?? []}
                    loading={viewers.isLoading}
                    likedBy={likers.data}
                    onOpenUser={openUser}
                  />
                </StoryOverlay>
              ) : null}
            </KeyboardAvoidingView>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
