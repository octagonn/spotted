import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { Music, VolumeX } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

export type PostMusic = {
  title: string;
  artist: string;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  /** Seconds into the preview where the poster's chosen clip starts. */
  clipStart?: number;
};

/**
 * Instagram-style post music: a slim "♫ Song · Artist" line under the post
 * header. The clip auto-plays (looping from the poster's chosen start) while
 * the post is the active one in the viewport — no tap needed. Tapping the
 * line mutes/unmutes that post's audio.
 */
export function MusicChip({
  music,
  disabled = false,
  active = false
}: {
  music: PostMusic;
  disabled?: boolean;
  /** True while this post is the visible one in the feed (drives autoplay). */
  active?: boolean;
}) {
  const player = useAudioPlayer(music.previewUrl ? { uri: music.previewUrl } : null);
  const status = useAudioPlayerStatus(player);
  const clipStart = music.clipStart ?? 0;
  const [muted, setMuted] = useState(false);
  const wasActive = useRef(false);

  const safePause = () => {
    try {
      player.pause();
    } catch {
      // Player already released — nothing to stop.
    }
  };

  // Autoplay while this post is the active one; stop the moment it isn't.
  useEffect(() => {
    if (!music.previewUrl || disabled) return;
    if (active && !muted && status.isLoaded) {
      try {
        if (!wasActive.current) {
          // Fresh activation — restart from the poster's chosen clip position.
          player.seekTo(clipStart).catch(() => {});
        }
        player.play();
      } catch {
        // Audio session hiccup — stay silent rather than crash.
      }
    } else {
      safePause();
    }
    wasActive.current = active;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, muted, disabled, status.isLoaded, music.previewUrl]);

  // Scrolling back to a muted post unmutes it again (Instagram behavior).
  useEffect(() => {
    if (!active) setMuted(false);
  }, [active]);

  // Loop the clip while the post stays active.
  useEffect(() => {
    if (!status.didJustFinish) return;
    player.seekTo(clipStart).catch(() => {});
    if (active && !muted && !disabled) {
      try {
        player.play();
      } catch {
        // Ignore — the next activation restarts it.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // Never leave audio running after the card unmounts.
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Already released.
      }
    };
  }, [player]);

  const playing = status.playing && !muted;

  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingTop: 7 }}>
      {music.artworkUrl ? (
        <Image source={{ uri: music.artworkUrl }} style={{ width: 18, height: 18, borderRadius: 4 }} contentFit="cover" />
      ) : (
        <Music size={12} color={colors.silver} strokeWidth={2} />
      )}
      <Music size={10} color={playing ? colors.white : colors.fog} strokeWidth={2.4} />
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: playing ? colors.silver : colors.fog }}
      >
        {music.title} · {music.artist}
      </Text>
      {muted ? <VolumeX size={12} color={colors.fog} strokeWidth={2} /> : null}
    </View>
  );

  if (!music.previewUrl || disabled) {
    return body;
  }
  return (
    <Pressable
      onPress={() => setMuted((m) => !m)}
      accessibilityLabel={muted ? "Unmute music" : "Mute music"}
      haptic={false}
    >
      {body}
    </Pressable>
  );
}
