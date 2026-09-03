import { useVideoPlayer, VideoView } from "expo-video";
import { Check, Pause, Play, RotateCcw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
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
 * trim bar with draggable start/end handles. The handles are driven by
 * reanimated shared values on the UI thread so they track the finger precisely
 * (#3) — React state is only committed on release (for the loop window + label).
 * The preview loops inside the trimmed window so what you see is what you'll
 * post. A load/decode failure shows a friendly retake state, never a crash.
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

  // UI-thread handle positions in PIXELS. Kept in sync with committed state.
  const startPx = useSharedValue(0);
  const endPx = useSharedValue(0);
  const startBase = useSharedValue(0);
  const endBase = useSharedValue(0);

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

  // Sync shared pixel positions whenever the geometry or committed trim changes
  // (initial load, or after a drag commits).
  useEffect(() => {
    if (!trackWidth || !duration) return;
    startPx.value = (trim.start / duration) * trackWidth;
    endPx.value = trim.end > 0 ? (trim.end / duration) * trackWidth : trackWidth;
  }, [trackWidth, duration, trim, startPx, endPx]);

  const togglePlay = () => {
    if (playing) player.pause();
    else {
      player.currentTime = Math.max(trimRef.current.start, 0);
      player.play();
    }
  };

  // Commit a dragged handle: px → seconds, update state, seek to the new start.
  const commit = (edge: "start" | "end", px: number) => {
    if (!trackWidth || !duration) return;
    const seconds = (px / trackWidth) * duration;
    setTrim((t) => {
      const next =
        edge === "start"
          ? { start: Math.min(Math.max(0, seconds), t.end - MIN_CLIP_SECONDS), end: t.end }
          : { start: t.start, end: Math.max(Math.min(duration, seconds), t.start + MIN_CLIP_SECONDS) };
      try {
        player.currentTime = Math.max(0, next.start);
      } catch {
        // seeking a torn-down player must never crash
      }
      return next;
    });
  };

  const minGapPx = trackWidth && duration ? (MIN_CLIP_SECONDS / duration) * trackWidth : 20;

  const startGesture = Gesture.Pan()
    .onStart(() => {
      startBase.value = startPx.value;
    })
    .onUpdate((e) => {
      startPx.value = Math.min(Math.max(0, startBase.value + e.translationX), endPx.value - minGapPx);
    })
    .onEnd(() => {
      runOnJS(commit)("start", startPx.value);
    });

  const endGesture = Gesture.Pan()
    .onStart(() => {
      endBase.value = endPx.value;
    })
    .onUpdate((e) => {
      endPx.value = Math.max(Math.min(trackWidth, endBase.value + e.translationX), startPx.value + minGapPx);
    })
    .onEnd(() => {
      runOnJS(commit)("end", endPx.value);
    });

  const leftDim = useAnimatedStyle(() => ({ width: startPx.value }));
  const rightDim = useAnimatedStyle(() => ({ left: endPx.value }));
  const keptStyle = useAnimatedStyle(() => ({ left: startPx.value, width: Math.max(0, endPx.value - startPx.value) }));
  const startHandleStyle = useAnimatedStyle(() => ({ left: Math.max(0, startPx.value - HANDLE_W / 2) }));
  const endHandleStyle = useAnimatedStyle(() => ({ left: Math.max(0, endPx.value - HANDLE_W / 2) }));

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Review video" onBack={onRetake} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white, textAlign: "center" }}>
            Couldn't play that clip
          </Text>
          <Text
            style={{
              marginTop: 10,
              fontFamily: "Geist_400Regular",
              fontSize: 13.5,
              lineHeight: 20,
              color: colors.fog,
              textAlign: "center"
            }}
          >
            The recording didn't load. Retake it and try again.
          </Text>
        </View>
        <View style={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 18 }}>
          <Button onPress={onRetake} icon={<RotateCcw size={16} color={colors.black} strokeWidth={2} />}>
            Restart
          </Button>
        </View>
      </View>
    );
  }

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
            style={{
              width: 66,
              height: 66,
              borderRadius: 33,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center"
            }}
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
            <Text
              style={{
                fontFamily: "GeistMono_400Regular",
                fontSize: 10.5,
                letterSpacing: 10.5 * 0.12,
                color: colors.fog
              }}
            >
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
            <Animated.View
              style={[
                { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
                leftDim
              ]}
            />
            <Animated.View
              style={[
                { position: "absolute", right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" },
                rightDim
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                { position: "absolute", top: 0, bottom: 0, borderWidth: 2, borderColor: colors.white, borderRadius: 8 },
                keptStyle
              ]}
            />
            <GestureDetector gesture={startGesture}>
              <Animated.View
                hitSlop={{ left: 16, right: 16, top: 12, bottom: 12 }}
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: HANDLE_W,
                    alignItems: "center",
                    justifyContent: "center"
                  },
                  startHandleStyle
                ]}
              >
                <View style={{ width: 5, height: 22, borderRadius: 2.5, backgroundColor: colors.white }} />
              </Animated.View>
            </GestureDetector>
            <GestureDetector gesture={endGesture}>
              <Animated.View
                hitSlop={{ left: 16, right: 16, top: 12, bottom: 12 }}
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: HANDLE_W,
                    alignItems: "center",
                    justifyContent: "center"
                  },
                  endHandleStyle
                ]}
              >
                <View style={{ width: 5, height: 22, borderRadius: 2.5, backgroundColor: colors.white }} />
              </Animated.View>
            </GestureDetector>
          </View>
          <Text style={{ paddingTop: 8, fontFamily: "Geist_400Regular", fontSize: 11.5, color: colors.fog }}>
            Drag the handles to trim. The preview loops inside your selection.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingBottom: insets.bottom + 18 }}>
        <Button
          variant="ghost"
          style={{ flex: 1 }}
          onPress={onRetake}
          icon={<RotateCcw size={16} color={colors.bone} strokeWidth={2} />}
        >
          Restart
        </Button>
        <Button
          style={{ flex: 1 }}
          onPress={() => onContinue(trimRef.current)}
          icon={<Check size={16} color={colors.black} strokeWidth={2.4} />}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}
