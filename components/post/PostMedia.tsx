import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { UserRound } from "lucide-react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable as NativePressable, ScrollView, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import { MuteIndicator } from "@/components/post/MuteIndicator";
import { ScenePhoto } from "@/components/post/ScenePhoto";
import { WorkoutSlideCard } from "@/components/post/WorkoutSlideCard";
import { LiftTag, PlayBadge, VChip, VidDur } from "@/components/ui/Chips";
import { useAudioStore } from "@/stores/audio";
import { usePostFrameRatio } from "@/lib/mediaAspect";
import { DEFAULT_POST_RATIO } from "@/lib/postFrame";
import type { FeedMockPost } from "@/lib/redesignData";
import { colors } from "@/theme/colors";
import { easing } from "@/theme/motion";

/** Mock video playback length (§4.3): progress 0→100% over 4.1s, reset ~4.3s. */
const VIDEO_PROGRESS_MS = 4100;
const VIDEO_RESET_MS = 4300;

/** "0:07" clock from a seconds value (rounds up so it never shows 0:00 mid-play). */
function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type MediaProps = {
  post: FeedMockPost;
  /** Blur radius applied to real photos when the feed is locked. */
  blurRadius?: number;
  /** True while this post is the active one in the viewport (video autoplay). */
  active?: boolean;
  /** Registers a single-tap action (video mute) with the gesture frame above,
   *  so taps route through MediaFrame instead of a tap-stealing Pressable. */
  onRegisterTap?: (handler: (() => void) | null) => void;
  /** Dual posts: inset/main swap, lifted to PostCard so the pinch-zoom
   *  preview always mirrors the CURRENTLY shown main photo. */
  swapped?: boolean;
  onToggleSwap?: () => void;
};

/** Front-and-back photo (`.fb`, §4.3.1) — frame follows the photo's own
 *  aspect ratio (no crop); optional 31% inset selfie. */
export function FbMedia({ post, blurRadius, swapped: swappedProp, onToggleSwap, onRegisterTap }: MediaProps) {
  const router = useRouter();
  // Frame ratio comes from the PRIMARY photo (not the swapped-in selfie) so
  // the card never changes height when the inset is tapped.
  const { ratio: frameRatio, onSize } = usePostFrameRatio(post.mediaUri);
  const hasInset = Boolean(post.inset || post.insetUri);
  const isLift = post.kind === "lift";
  // BeReal-style: tapping the corner selfie swaps it with the main photo (and
  // back). Controlled by PostCard when provided (keeps zoom in sync); local
  // state is the fallback for standalone uses.
  const [localSwapped, setLocalSwapped] = useState(false);
  const swapped = swappedProp ?? localSwapped;
  const toggleSwap = onToggleSwap ?? (() => setLocalSwapped((s) => !s));
  // IG-style tags: pills start HIDDEN; a single tap on the photo (or the
  // person icon bottom-left) reveals them. They also hide while the inset is
  // swapped in — their coordinates belong to the main photo.
  const [showTags, setShowTags] = useState(false);
  const hasTags = Boolean(post.photoTags?.length);
  useEffect(() => {
    if (!hasTags || !onRegisterTap) return;
    onRegisterTap(() => setShowTags((v) => !v));
    return () => onRegisterTap(null);
  }, [hasTags, onRegisterTap]);
  const mainUri = swapped && hasInset ? post.insetUri : post.mediaUri;
  const mainScene = swapped && hasInset ? post.inset : post.main;
  const cornerUri = swapped ? post.mediaUri : post.insetUri;
  const cornerScene = swapped ? post.main : post.inset;
  return (
    <View style={{ width: "100%", aspectRatio: frameRatio }}>
      <ScenePhoto
        uri={mainUri}
        scene={mainScene}
        blurRadius={blurRadius}
        // Size only from the primary photo — the swapped-in selfie must not
        // resize the card.
        onSize={!swapped ? onSize : undefined}
        accessibilityLabel={post.caption ? `Post: ${post.caption}` : "Post photo"}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Positional photo tags (M1) — pills at their normalized coords,
          revealed by tapping the photo or the person icon. */}
      {hasTags && showTags && !swapped && blurRadius === undefined ? (
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}>
          {post.photoTags!.map((t, i) => (
            <NativePressable
              key={`${t.username}-${i}`}
              onPress={() => router.push(`/user/${t.username}`)}
              style={{ position: "absolute", left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
            >
              <View style={{ marginTop: -14, flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
                <Text style={{ fontFamily: "Geist_500Medium", fontSize: 12, color: colors.white }}>@{t.username}</Text>
              </View>
            </NativePressable>
          ))}
        </View>
      ) : null}
      {/* Tagged-users toggle — person puck bottom-left (opposite the music
          speaker), shown whenever the photo has tags. */}
      {hasTags && blurRadius === undefined ? (
        <NativePressable
          onPress={() => setShowTags((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showTags ? "Hide tagged people" : "Show tagged people"}
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 6
          }}
        >
          <UserRound size={15} color={colors.white} strokeWidth={2.2} />
        </NativePressable>
      ) : null}
      {isLift ? (
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
          locations={[0, 0.35, 1]}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {hasInset ? (
        <NativePressable
          onPress={() => blurRadius === undefined && toggleSwap()}
          accessibilityRole="button"
          accessibilityLabel={swapped ? "Show the main photo full size" : "Show the front-camera photo full size"}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            width: "31%",
            aspectRatio: 3 / 4,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.black,
            overflow: "hidden",
            zIndex: 3,
            shadowColor: "#000",
            shadowOpacity: 0.55,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8
          }}
        >
          <ScenePhoto uri={cornerUri} scene={cornerScene} blurRadius={blurRadius} legibility={false} />
        </NativePressable>
      ) : null}
      {isLift && post.lift ? (
        <LiftTag lift={post.lift.lift} weight={post.lift.weight} style={{ position: "absolute", top: 12, left: 12, zIndex: 4 }} />
      ) : null}
      {isLift ? (
        <>
          <PlayBadge style={{ position: "absolute", top: "50%", left: "50%", marginTop: -28, marginLeft: -28, zIndex: 3 }} />
          {post.duration ? (
            <VidDur style={{ position: "absolute", bottom: 12, right: 12, zIndex: 3 }}>{post.duration}</VidDur>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Milestone plate (`.plate-card`, §4.3.2) — kinds pr / streak. */
export function PlateCard({ post }: MediaProps) {
  if (!post.plate) {
    return null;
  }
  return (
    <View
      style={{
        marginHorizontal: 18,
        borderWidth: 1,
        borderColor: colors.slate,
        borderRadius: 16,
        overflow: "hidden",
        paddingTop: 24,
        paddingHorizontal: 18,
        paddingBottom: 22,
        alignItems: "center"
      }}
    >
      <LinearGradient
        colors={[colors.graphite, colors.ink]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Decorative circles: 220px top −84 / right −70; 140px bottom −64 / left −52 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          borderWidth: 1,
          borderColor: colors.iron,
          top: -84,
          right: -70
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 140,
          height: 140,
          borderRadius: 70,
          borderWidth: 1,
          borderColor: colors.iron,
          bottom: -64,
          left: -52
        }}
      />
      <Text
        style={{
          fontFamily: "Geist_500Medium",
          fontSize: 11,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: colors.silver,
          marginBottom: 10
        }}
      >
        {`◎ ${post.plate.tag}`}
      </Text>
      {/* Boldonse has very tall glyph metrics — iOS clips anything shorter
          than ~1.6x lineHeight, so give it real headroom. */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          maxFontSizeMultiplier={1.4}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: "Boldonse_400Regular",
            fontSize: 44,
            lineHeight: 44 * 1.6,
            color: colors.white,
            includeFontPadding: false
          }}
        >
          {post.plate.big}
        </Text>
        <Text
          style={{
            fontSize: 18,
            color: colors.fog,
            letterSpacing: 18 * 0.08,
            marginLeft: 9
          }}
        >
          {post.plate.unit}
        </Text>
      </View>
    </View>
  );
}

/** Video media (`.fb.lift-video`, §4.3.3) — tap-to-play mock with 3px progress bar. */
export function VideoMedia({ post, blurRadius }: MediaProps) {
  const [playing, setPlaying] = useState(false);
  const progress = useSharedValue(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
      cancelAnimation(progress);
    };
  }, [progress]);

  const play = () => {
    if (playing) {
      return;
    }
    setPlaying(true);
    progress.value = 0;
    progress.value = withTiming(1, { duration: VIDEO_PROGRESS_MS, easing: easing.linear });
    resetTimer.current = setTimeout(() => {
      setPlaying(false);
      progress.value = 0;
    }, VIDEO_RESET_MS);
  };

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`
  }));

  return (
    <NativePressable onPress={play} disabled={blurRadius !== undefined}>
      <View style={{ width: "100%", aspectRatio: DEFAULT_POST_RATIO }}>
        <ScenePhoto
          uri={post.mediaUri}
          scene={post.main}
          blurRadius={blurRadius}
          accessibilityLabel={post.caption ? `Post: ${post.caption}` : "Post video"}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* Extra video scrim: rgba(0,0,0,0.3) → transparent 35% → rgba(0,0,0,0.55) */}
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
          locations={[0, 0.35, 1]}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {post.chips?.length ? (
          <View style={{ position: "absolute", top: 12, left: 12, zIndex: 3, flexDirection: "row", gap: 6 }}>
            {post.chips.map((chip) => (
              <VChip key={chip} hot={chip === "PR"}>
                {chip === "PR" ? "◎ PR" : chip}
              </VChip>
            ))}
          </View>
        ) : null}
        {!playing ? (
          <PlayBadge style={{ position: "absolute", top: "50%", left: "50%", marginTop: -28, marginLeft: -28, zIndex: 3 }} />
        ) : null}
        {post.duration ? (
          <VidDur style={{ position: "absolute", bottom: 12, right: 12, zIndex: 3 }}>{post.duration}</VidDur>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", bottom: 0, left: 0, height: 3, backgroundColor: colors.white, zIndex: 4 },
            progressStyle
          ]}
        />
      </View>
    </NativePressable>
  );
}

/** Compare tag (`.cmp-tag`): mono 10 700 ls 0.16em, radius 6. */
function CmpTag({ label, right }: { label: string; right?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 12,
        left: right ? undefined : 12,
        right: right ? 12 : undefined,
        zIndex: 3,
        backgroundColor: right ? colors.white : "rgba(0,0,0,0.6)",
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 6
      }}
    >
      <Text
        style={{
          fontFamily: "Geist_600SemiBold",
          fontSize: 10,
          letterSpacing: 1,
          color: right ? colors.black : colors.silver
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Before/after compare (`.cmp`, §4.3.4) — aspect 3/2.4, right image clipped from
 * the divider, 2px white divider with 34px ↔ knob. A horizontal pan drags the
 * divider live between 6% and 94%.
 */
export function CompareMedia({ post, blurRadius }: MediaProps) {
  const [width, setWidth] = useState(0);
  const pct = useSharedValue(50);

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (width > 0) {
        const next = (event.x / width) * 100;
        pct.value = Math.min(94, Math.max(6, next));
      }
    });

  const afterStyle = useAnimatedStyle(() => ({
    width: `${100 - pct.value}%`
  }));
  const dividerStyle = useAnimatedStyle(() => ({
    left: `${pct.value}%`
  }));

  if (!post.cmp) {
    return null;
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ width: "100%", aspectRatio: 3 / 2.4, overflow: "hidden" }}
      >
        <ScenePhoto
          uri={post.mediaUri}
          scene={post.cmp.beforeScene}
          blurRadius={blurRadius}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* After half — anchored right, clipped at the divider */}
        {width > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: "absolute", top: 0, right: 0, bottom: 0, overflow: "hidden" }, afterStyle]}
          >
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, width }}>
              <ScenePhoto uri={post.insetUri} scene={post.cmp.afterScene} blurRadius={blurRadius} />
            </View>
          </Animated.View>
        ) : null}
        <CmpTag label={post.cmp.left} />
        <CmpTag label={post.cmp.right} right />
        {/* Divider + knob */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.white, zIndex: 4 },
            dividerStyle
          ]}
        >
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              marginTop: -17,
              marginLeft: -17,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>↔</Text>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/**
 * Real recorded lift clip — Instagram-style: autoplays while it's the active
 * post in the viewport and pauses when it scrolls away (never a manual play).
 * There's no play button. Tapping toggles the GLOBAL feed mute (shared with all
 * videos and music posts) and flashes a speaker indicator on this post.
 */
function RealVideoMedia({ post, blurRadius, active, onRegisterTap }: MediaProps) {
  const video = post.video as NonNullable<FeedMockPost["video"]>;
  const muted = useAudioStore((s) => s.muted);
  const nonce = useAudioStore((s) => s.nonce);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const [localNonce, setLocalNonce] = useState(0);
  // Live countdown of time left in the current loop (seconds), or null before load.
  const [remaining, setRemaining] = useState<number | null>(null);
  const player = useVideoPlayer(video.uri, (p) => {
    // Native loop handles the natural end (untrimmed clips auto-replay); the
    // timeUpdate listener loops earlier when there's a trim window.
    p.loop = true;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.2;
    p.pause();
  });

  // Follow the global mute switch.
  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // Ignore — player not ready.
    }
  }, [muted, player]);

  useEffect(() => {
    const timeSub = player.addListener("timeUpdate", ({ currentTime }) => {
      const trimmed = video.trimEnd > video.trimStart;
      const end = trimmed ? video.trimEnd : player.duration || 0;
      // Loop within the trim window (before the natural end that native loop handles).
      if (trimmed && currentTime >= video.trimEnd) {
        player.currentTime = video.trimStart;
        setRemaining(Math.max(0, video.trimEnd - video.trimStart));
        return;
      }
      if (end > 0) setRemaining(Math.max(0, end - currentTime));
    });
    return () => timeSub.remove();
  }, [player, video.trimStart, video.trimEnd]);

  // Play only while this post is the active one; pause when it scrolls away.
  useEffect(() => {
    try {
      if (active && blurRadius === undefined) {
        if (player.currentTime < video.trimStart) player.currentTime = video.trimStart;
        player.play();
      } else {
        player.pause();
      }
    } catch {
      // Player not ready / torn down — ignore.
    }
  }, [active, blurRadius, player, video.trimStart]);

  const onTapMute = () => {
    toggleMuted();
    // Record the nonce this tap will produce so only this post flashes.
    setLocalNonce(nonce + 1);
  };
  // Mute toggling routes through MediaFrame's single-tap gesture — a Pressable
  // here would steal the first tap of a double-tap and break like-on-double-tap.
  const tapRef = useRef(onTapMute);
  tapRef.current = onTapMute;
  useEffect(() => {
    onRegisterTap?.(() => tapRef.current());
    return () => onRegisterTap?.(null);
  }, [onRegisterTap]);

  if (blurRadius !== undefined) {
    // Locked feed: no playback, just the frosted placeholder tile.
    return <View style={{ width: "100%", aspectRatio: DEFAULT_POST_RATIO, backgroundColor: colors.graphite }} />;
  }

  return (
    <View style={{ width: "100%", aspectRatio: DEFAULT_POST_RATIO, backgroundColor: colors.graphite }}>
      {/* Poster frame paints instantly under the player while the stream
          buffers — without it the tile sits flat graphite and reads as slow. */}
      {video.posterUrl ? (
        <Image
          source={{ uri: video.posterUrl }}
          accessible={false}
          contentFit="cover"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      <VideoView
        player={player}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        nativeControls={false}
        accessible
        accessibilityLabel={post.caption ? `Post: ${post.caption}` : "Post video"}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
        locations={[0, 0.35, 1]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {post.lift ? (
        <LiftTag lift={post.lift.lift} weight={post.lift.weight} style={{ position: "absolute", top: 12, left: 12, zIndex: 4 }} />
      ) : null}
      {remaining != null || post.duration ? (
        <VidDur style={{ position: "absolute", bottom: 12, right: 12, zIndex: 3 }}>
          {remaining != null ? formatClock(remaining) : (post.duration as string)}
        </VidDur>
      ) : null}
      <MuteIndicator muted={muted} nonce={nonce} local={localNonce} />
    </View>
  );
}

/** Multi-photo carousel — swipeable pages with a dots indicator + counter. */
function CarouselMedia({ post, blurRadius }: MediaProps) {
  const uris = post.mediaUris as string[];
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  // One shared frame for every page (paging needs equal heights) — sized by
  // the first photo, which every later shot in the session matches anyway.
  const { ratio: frameRatio, onSize } = usePostFrameRatio(uris?.[0]);
  // Warm every frame up front so paging between photos is instant instead of
  // decoding on-demand as you swipe.
  useEffect(() => {
    if (uris?.length) void Image.prefetch(uris);
  }, [uris]);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: "100%", aspectRatio: frameRatio }}
    >
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={blurRadius === undefined}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {uris.map((uri, i) => (
            <View key={uri} style={{ width, height: "100%" }}>
              <ScenePhoto uri={uri} blurRadius={blurRadius} legibility={false} onSize={i === 0 ? onSize : undefined} accessibilityLabel={post.caption ? `Post: ${post.caption}` : "Post photo"} />
            </View>
          ))}
        </ScrollView>
      ) : null}
      {/* Counter chip */}
      <View pointerEvents="none" style={{ position: "absolute", top: 12, right: 12, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Text style={{ fontFamily: "Geist_500Medium", fontSize: 12, color: colors.white }}>
          {`${index + 1}/${uris.length}`}
        </Text>
      </View>
      {/* Dots */}
      <View pointerEvents="none" style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {uris.map((uri, i) => (
          <View
            key={uri}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? colors.white : "rgba(255,255,255,0.4)"
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Photo(s) + attached workout cards in one swipeable stack. Slide 0 = the
 * daily photo (or a photo carousel), slides after = each workout the user
 * did that day (2nd+ workouts appended later). Blurred/locked = photo only.
 */
function PostStack({ post, blurRadius }: MediaProps) {
  const photos = (post.mediaUris?.length ?? 0) > 1 ? (post.mediaUris as string[]) : post.mediaUri ? [post.mediaUri] : [];
  const workouts = post.workouts ?? [];
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  // Dual-camera selfie. FbMedia drew this but the stack never did, so
  // attaching a workout to a dual post silently DROPPED the front camera from
  // the feed ("dual posts only keep the back camera photo when u add ur
  // workout"). Same corner PIP + tap-to-swap as FbMedia, on the photo slide.
  const [swapped, setSwapped] = useState(false);
  const hasInset = Boolean(post.insetUri);
  const total = photos.length + workouts.length;
  // Frame follows the daily photo; workout slides stretch to the same height.
  const { ratio: frameRatio, onSize } = usePostFrameRatio(photos[0]);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: "100%", aspectRatio: frameRatio }}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Locked feed = photo only, no swiping into the workout data.
          scrollEnabled={blurRadius === undefined}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {photos.map((uri, photoIndex) => {
            const showInset = hasInset && photoIndex === 0;
            const mainUri = showInset && swapped ? (post.insetUri as string) : uri;
            const cornerUri = swapped ? uri : post.insetUri;
            return (
              <View key={uri} style={{ width, height: "100%" }}>
                <ScenePhoto
                  uri={mainUri}
                  blurRadius={blurRadius}
                  legibility={false}
                  // Size only from the first photo, unswapped — selfie swaps
                  // and later pages must not resize the stack.
                  onSize={photoIndex === 0 && !(showInset && swapped) ? onSize : undefined}
                  accessibilityLabel={post.caption ? `Post: ${post.caption}` : "Post photo"}
                />
                {showInset ? (
                  <NativePressable
                    onPress={() => blurRadius === undefined && setSwapped((s) => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={swapped ? "Show the main photo full size" : "Show the front-camera photo full size"}
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      width: "31%",
                      aspectRatio: 3 / 4,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: colors.black,
                      overflow: "hidden",
                      zIndex: 3,
                      shadowColor: "#000",
                      shadowOpacity: 0.55,
                      shadowRadius: 20,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 8
                    }}
                  >
                    <ScenePhoto uri={cornerUri} blurRadius={blurRadius} legibility={false} />
                  </NativePressable>
                ) : null}
              </View>
            );
          })}
          {blurRadius === undefined
            ? workouts.map((w) => (
                <View key={w.id} style={{ width, height: "100%" }}>
                  <WorkoutSlideCard workout={w} />
                </View>
              ))
            : null}
        </ScrollView>
      ) : null}
      <View pointerEvents="none" style={{ position: "absolute", top: 12, right: 12, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Text style={{ fontFamily: "Geist_500Medium", fontSize: 12, color: colors.white }}>{`${index + 1}/${total}`}</Text>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              // Workout dots tint gold so you know there's training data ahead.
              backgroundColor: i === index ? colors.white : i >= photos.length ? "rgba(232,180,76,0.55)" : "rgba(255,255,255,0.4)"
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Media router (§4.3) — picks the media kind for a post. */
export function PostMedia({ post, blurRadius, active, onRegisterTap, swapped, onToggleSwap }: MediaProps) {
  if (post.video) {
    return <RealVideoMedia post={post} blurRadius={blurRadius} active={active} onRegisterTap={onRegisterTap} />;
  }
  // Daily photo posts with attached workouts render as a photo + workout stack.
  if ((post.workouts?.length ?? 0) > 0 && !post.video) {
    return <PostStack post={post} blurRadius={blurRadius} />;
  }
  if ((post.mediaUris?.length ?? 0) > 1) {
    return <CarouselMedia post={post} blurRadius={blurRadius} />;
  }
  if (post.kind === "pr" || post.kind === "streak") {
    return <PlateCard post={post} />;
  }
  if (post.kind === "video") {
    return <VideoMedia post={post} blurRadius={blurRadius} />;
  }
  if (post.kind === "compare") {
    return <CompareMedia post={post} blurRadius={blurRadius} />;
  }
  return <FbMedia post={post} blurRadius={blurRadius} swapped={swapped} onToggleSwap={onToggleSwap} onRegisterTap={onRegisterTap} />;
}
