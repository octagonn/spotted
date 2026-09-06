import { useQuery } from "@tanstack/react-query";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Eye, Flame, Pause, Play, Share2, X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable as RNPressable, StyleSheet, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { ChatMessage } from "@/hooks/queries/useMessages";
import { signedMessageUrl, signedPostUrl } from "@/lib/supabase";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Media bubble box (photo/video). */
const MEDIA_W = 210;
const MEDIA_H = 270;

const bubbleFrame = (mine: boolean) =>
  ({
    alignSelf: mine ? "flex-end" : "flex-start",
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: tokens.bg.raised,
    borderWidth: mine ? 0 : 1,
    borderColor: tokens.border.default
  }) as const;

/** Voice-note bubble: play/pause + progress + elapsed time. */
export function AudioBubble({ uri, mine }: { uri: string | null; mine: boolean }) {
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
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`${status.playing ? "Pause" : "Play"} voice message, ${duration} seconds`}
      haptic="none"
    >
      <View
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: space[2] + 2,
          maxWidth: "78%",
          borderRadius: radius.pill,
          paddingVertical: space[2] + 2,
          paddingHorizontal: space[3] + 2,
          backgroundColor: mine ? colors.white : tokens.bg.raised,
          borderWidth: mine ? 0 : 1,
          borderColor: tokens.border.default
        }}
      >
        {status.playing ? (
          <Pause size={icon.size.xs} color={fg} strokeWidth={icon.stroke.bold} fill={fg} />
        ) : (
          <Play size={icon.size.xs} color={fg} strokeWidth={icon.stroke.bold} fill={fg} />
        )}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: duration, now: current }}
          style={{
            width: 110,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: mine ? colors.scrim : tokens.border.default
          }}
        >
          <View
            style={{
              width: `${Math.min(100, (current / duration) * 100)}%`,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: fg
            }}
          />
        </View>
        <Text variant="mono" className={mine ? "text-black" : "text-white"}>
          {`0:${String(status.playing || current > 0 ? current : duration).padStart(2, "0")}`}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Legacy: older DMs sent as a reply to a (since removed) story still carry
 * `reply_story_media`. Render a static "replied to a story" line + thumbnail
 * so those threads keep making sense; there is no story viewer to open.
 */
export function StoryReplyPreview({ path, mine }: { path: string; mine: boolean }) {
  const media = useQuery({
    queryKey: ["story-reply-thumb", path],
    staleTime: 50 * 60_000,
    queryFn: () => signedPostUrl(path)
  });
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        alignItems: mine ? "flex-end" : "flex-start",
        marginBottom: -4
      }}
    >
      <Text variant="mono" className="mb-1 mx-1 text-[10px]">
        {mine ? "You replied to their story" : "Replied to your story"}
      </Text>
      <View
        style={{
          width: 54,
          height: 84,
          borderRadius: radius.sm,
          overflow: "hidden",
          backgroundColor: tokens.bg.raised
        }}
      >
        {media.data ? (
          <CachedImage source={{ uri: media.data }} style={{ width: 54, height: 84 }} contentFit="cover" />
        ) : null}
      </View>
    </View>
  );
}

/** Video message bubble — inline looping player. */
export function VideoBubble({ uri, mine }: { uri: string | null; mine: boolean }) {
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = true;
    p.muted = false;
  });
  return (
    <View style={bubbleFrame(mine)}>
      {uri ? (
        <VideoView player={player} style={{ width: MEDIA_W, height: MEDIA_H }} contentFit="cover" nativeControls />
      ) : (
        <View style={{ width: MEDIA_W, height: MEDIA_H }} />
      )}
    </View>
  );
}

/** In-app share card — a tappable preview of a shared post/check-in/stream. */
export function ShareCard({
  mine,
  label,
  sharedKind,
  onOpen
}: {
  mine: boolean;
  label: string;
  sharedKind: string;
  onOpen: () => void;
}) {
  const heading =
    sharedKind === "post"
      ? "Post"
      : sharedKind === "workout"
        ? "Workout"
        : sharedKind === "stream"
          ? "Gym stream"
          : "Gym check-in";
  return (
    <Pressable
      onPress={onOpen}
      haptic="none"
      accessibilityLabel={`Open shared ${heading.toLowerCase()}: ${label}`}
      style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: 240 }}
    >
      <View
        style={{
          borderRadius: radius.md,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.border.default,
          backgroundColor: tokens.bg.raised
        }}
      >
        <View
          style={{
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            borderBottomWidth: 1,
            borderBottomColor: tokens.border.default,
            flexDirection: "row",
            alignItems: "center",
            gap: space[1] + 2
          }}
        >
          <Share2 size={13} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
          <Text variant="micro">{heading}</Text>
        </View>
        <Text variant="body-sm" className="px-3 py-2">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Photo / voice / video message — resolves the private-bucket signed URL. */
export function ChatMediaBubble({
  path,
  mine,
  onOpen,
  onLongPress
}: {
  path: string;
  mine: boolean;
  onOpen?: (uri: string) => void;
  /** Reaction menu. A nested Pressable steals the responder from the row
   *  wrapper, so without this a long-press on a photo never opened the menu. */
  onLongPress?: () => void;
}) {
  const media = useQuery({
    queryKey: ["msg-media", path],
    staleTime: 50 * 60_000,
    queryFn: () => signedMessageUrl(path)
  });
  const lower = path.toLowerCase();
  if (lower.endsWith(".m4a")) return <AudioBubble uri={media.data ?? null} mine={mine} />;
  if (lower.endsWith(".mp4") || lower.endsWith(".mov")) return <VideoBubble uri={media.data ?? null} mine={mine} />;
  return (
    <View style={bubbleFrame(mine)}>
      {media.data ? (
        <RNPressable
          onPress={() => onOpen?.(media.data as string)}
          onLongPress={onLongPress}
          delayLongPress={220}
          accessibilityLabel="View photo"
        >
          <CachedImage source={{ uri: media.data }} style={{ width: MEDIA_W, height: MEDIA_H }} contentFit="cover" />
        </RNPressable>
      ) : (
        <View style={{ width: MEDIA_W, height: MEDIA_H }} />
      )}
    </View>
  );
}

/**
 * View-once photo bubble. Sender sees a static "Photo" chip (with an "Opened"
 * state once the recipient burns it). The recipient gets a tappable chip that
 * opens the photo full-screen exactly once. Gold marks "there's something to
 * open" — an active state that expires.
 */
export function ViewOnceBubble({
  message,
  mine,
  onOpen
}: {
  message: ChatMessage;
  mine: boolean;
  onOpen: (message: ChatMessage) => void;
}) {
  const opened = Boolean(message.viewed_at);
  const canOpen = !mine && !opened;
  return (
    <RNPressable
      onPress={canOpen ? () => onOpen(message) : undefined}
      accessibilityLabel={canOpen ? "View photo (view once)" : opened ? "Photo opened" : "Photo sent"}
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: canOpen ? tokens.accent.gold : tokens.border.default,
        backgroundColor: canOpen ? tokens.accent.goldSubtle : tokens.bg.raised,
        paddingVertical: space[2] + 2,
        paddingHorizontal: space[4],
        marginVertical: 2
      }}
    >
      {opened ? (
        <Eye size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
      ) : (
        <Flame
          size={icon.size.xs}
          color={canOpen ? tokens.accent.gold : tokens.text.secondary}
          strokeWidth={icon.stroke.regular}
        />
      )}
      <Text variant="meta-strong" className={opened ? "text-fog" : canOpen ? "text-gold" : "text-silver"}>
        {opened ? "Opened" : mine ? "Photo — view once" : "Tap to view photo"}
      </Text>
    </RNPressable>
  );
}

/** Close puck for full-screen viewers, over a scrim. */
function ViewerClose({ onPress, decorative = false }: { onPress?: () => void; decorative?: boolean }) {
  const body = (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: tokens.bg.scrim,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <X size={icon.size.sm} color={colors.white} strokeWidth={icon.stroke.bold} />
    </View>
  );
  if (decorative) {
    return (
      <View pointerEvents="none" style={{ position: "absolute", top: 54, right: 20 }}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      haptic="none"
      accessibilityLabel="Close photo"
      hitSlop={12}
      style={{ position: "absolute", top: 54, right: 20 }}
    >
      {body}
    </Pressable>
  );
}

/** Full-screen chat photo viewer — the X is the only way out. */
export function ChatPhotoViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.black, zIndex: 40 }]}>
      <CachedImage source={{ uri }} style={{ flex: 1 }} contentFit="contain" />
      <ViewerClose onPress={onClose} />
    </View>
  );
}

/**
 * Full-screen one-shot photo viewer. Consumes ON OPEN: the moment the signed
 * image is in hand, onConsume marks it viewed server-side — which also
 * destroys the storage object — so killing the app mid-view still counts.
 */
export function ViewOnceViewer({
  path,
  onConsume,
  onClose
}: {
  path: string;
  onConsume: () => void;
  onClose: () => void;
}) {
  const media = useQuery({
    queryKey: ["msg-media", path],
    staleTime: 50 * 60_000,
    queryFn: () => signedMessageUrl(path)
  });
  const consumedRef = useRef(false);
  useEffect(() => {
    if (media.data && !consumedRef.current) {
      consumedRef.current = true;
      onConsume();
    }
  }, [media.data, onConsume]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.black, zIndex: 40 }]}>
      {/* Tap anywhere to close. */}
      <Pressable onPress={onClose} haptic="none" accessibilityLabel="Close photo" style={{ flex: 1 }}>
        {media.data ? (
          <Image source={{ uri: media.data }} style={{ flex: 1 }} contentFit="contain" />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </Pressable>
      <ViewerClose decorative />
      <View pointerEvents="none" style={{ position: "absolute", bottom: 46, left: 0, right: 0, alignItems: "center" }}>
        <Text variant="label">View once — it disappears when you close it</Text>
      </View>
    </View>
  );
}
