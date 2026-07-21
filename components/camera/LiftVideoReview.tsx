import { useVideoPlayer, VideoView } from "expo-video";
import { Pause, Play, RotateCcw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { logger } from "@/lib/logger";
import { colors } from "@/theme/colors";

export type VideoTrim = { start: number; end: number };

const TRACK_H = 44;
const HANDLE_W = 18;
const MIN_CLIP_SECONDS = 1;

function fmt(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `0:${String(s).padStart(2, "0")}`;
}

/**
 * Review screen for a recorded max-lift clip: real playback (expo-video) plus a
 * trim bar with draggable start/end handles. The preview loops inside the
 * trimmed window so what you see is what you'll post. Trimming is stored as a
 * time range (soft trim) — the file itself is cut server-side at publish.
 * A load/decode failure shows a friendly retake state, never a crash.
 */
export function LiftVideoReview({
  uri,
  onRetake,
  onContinue
}: {
  uri: string;
  onRetake: () => void;
  onContinue: (trim: VideoTrim) => void;
}) {
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState(0);
  const [trim, setTrim] = useState<VideoTrim>({ start: 0, end: 0 });
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const trimRef = useRef(trim);
  trimRef.current = trim;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.2;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    const statusSub = player.addListener("statusChange", ({ status, error }) => {
      if (status === "readyToPlay") {
        const d = player.duration;
        if (d > 0) {
          setDuration(d);
          setTrim((t) => (t.end > 0 ? t : { start: 0, end: d }));
        }
      }
      if (status === "error") {
        logger.warn("lift_video_load_failed", { message: error?.message ?? "unknown" });
        setFailed(true);
      }
    });
    const timeSub = player.addListener("timeUpdate", ({ currentTime }) => {
      const { start, end } = trimRef.current;
      // Loop the preview inside the trim window.
      if (end > 0 && (currentTime >= end || currentTime < start - 0.4)) {
        player.currentTime = start;
        player.play();
      }
    });
    const playSub = player.addListener("playingChange", ({ isPlaying }) => setPlaying(isPlaying));
    return () => {
      statusSub.remove();
      timeSub.remove();
      playSub.remove();
    };
  }, [player]);

  const togglePlay = () => {
    if (playing) player.pause();
    else {
      player.currentTime = Math.max(trimRef.current.start, 0);
      player.play();
    }
  };

  const seekPreview = (seconds: number) => {
    try {
      player.currentTime = seconds;
    } catch {
      // Seeking a torn-down player must never crash the screen.
    }
  };

  const makeHandle = (edge: "start" | "end") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gesture) => {
        if (!trackWidth || !duration) return;
        const t = trimRef.current;
        const base = edge === "start" ? t.start : t.end;
        const next = base + (gesture.dx / trackWidth) * duration;
        if (edge === "start") {
          const clamped = Math.min(Math.max(0, next), t.end - MIN_CLIP_SECONDS);
          if (Number.isFinite(clamped)) setTrim({ start: clamped, end: t.end });
        } else {
          const clamped = Math.max(Math.min(duration, next), t.start + MIN_CLIP_SECONDS);
          if (Number.isFinite(clamped)) setTrim({ start: t.start, end: clamped });
        }
      },
      onPanResponderRelease: () => {
        seekPreview(trimRef.current.start);
      }
    });

  const startPan = useRef(makeHandle("start"));
  const endPan = useRef(makeHandle("end"));
  // PanResponders capture trackWidth/duration via refs-in-closure; recreate when they land.
  useEffect(() => {
    startPan.current = makeHandle("start");
    endPan.current = makeHandle("end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth, duration]);

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Review video" onBack={onRetake} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white, textAlign: "center" }}>
            Couldn't play that clip
          </Text>
          <Text style={{ marginTop: 10, fontFamily: "Geist_400Regular", fontSize: 13.5, lineHeight: 20, color: colors.fog, textAlign: "center" }}>
            The recording didn't load. Retake it and try again.
          </Text>
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 18 }}>
          <Button onPress={onRetake} icon={<RotateCcw size={16} color={colors.black} strokeWidth={2} />}>
            Retake
          </Button>
        </View>
      </View>
    );
  }

  const startX = duration ? (trim.start / duration) * trackWidth : 0;
  const endX = duration ? (trim.end / duration) * trackWidth : trackWidth;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Review video" onBack={onRetake} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
        <View
          style={{
            width: "100%",
            aspectRatio: 3 / 4,
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: colors.graphite,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <VideoView
            player={player}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            nativeControls={false}
          />
          <Pressable
            onPress={togglePlay}
            accessibilityLabel={playing ? "Pause" : "Play"}
            style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            {playing ? (
              <Pause size={28} color={colors.white} strokeWidth={2} fill={colors.white} />
            ) : (
              <Play size={28} color={colors.white} strokeWidth={2} fill={colors.white} />
            )}
          </Pressable>
        </View>

        {/* Trim bar */}
        <View style={{ width: "100%", paddingTop: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 8 }}>
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, color: colors.fog }}>
              TRIM
            </Text>
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.silver }}>
              {fmt(trim.start)} – {fmt(trim.end)} · {fmt(Math.max(0, trim.end - trim.start))}
            </Text>
          </View>
          <View
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            style={{ height: TRACK_H, borderRadius: 10, backgroundColor: colors.graphite, overflow: "hidden" }}
          >
            {/* Dimmed outside the kept range */}
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: startX, backgroundColor: "rgba(0,0,0,0.55)" }} />
            <View style={{ position: "absolute", left: endX, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />
            {/* Kept range outline */}
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: startX, width: Math.max(0, endX - startX), top: 0, bottom: 0, borderWidth: 2, borderColor: colors.white, borderRadius: 8 }}
            />
            {/* Handles */}
            <View
              {...startPan.current.panHandlers}
              hitSlop={{ left: 14, right: 14, top: 10, bottom: 10 }}
              style={{ position: "absolute", left: Math.max(0, startX - HANDLE_W / 2), top: 0, bottom: 0, width: HANDLE_W, alignItems: "center", justifyContent: "center" }}
            >
              <View style={{ width: 5, height: 22, borderRadius: 2.5, backgroundColor: colors.white }} />
            </View>
            <View
              {...endPan.current.panHandlers}
              hitSlop={{ left: 14, right: 14, top: 10, bottom: 10 }}
              style={{ position: "absolute", left: Math.min(trackWidth - HANDLE_W / 2, endX - HANDLE_W / 2), top: 0, bottom: 0, width: HANDLE_W, alignItems: "center", justifyContent: "center" }}
            >
              <View style={{ width: 5, height: 22, borderRadius: 2.5, backgroundColor: colors.white }} />
            </View>
          </View>
          <Text style={{ paddingTop: 8, fontFamily: "Geist_400Regular", fontSize: 11.5, color: colors.fog }}>
            Drag the handles to trim. The preview loops inside your selection.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 18 }}>
        <Button variant="ghost" style={{ flex: 1 }} onPress={onRetake} icon={<RotateCcw size={16} color={colors.bone} strokeWidth={2} />}>
          Retake
        </Button>
        <Button style={{ flex: 1 }} onPress={() => onContinue(trimRef.current)}>
          Continue
        </Button>
      </View>
    </View>
  );
}
