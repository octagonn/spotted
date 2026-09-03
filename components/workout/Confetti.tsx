import { useEffect, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated";

import { tokens } from "@/theme/tokens";

/** Prototype `confFall` palette — gold-forward with white sparks. */
const COLORS = [tokens.accent.gold, "#FFFFFF", "#FFD76A", tokens.accent.gold];

type Piece = {
  key: string;
  left: number; // % of width
  duration: number;
  delay: number;
  size: number;
  color: string;
  round: boolean;
};

function PieceView({ piece, height }: { piece: Piece; height: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.bezier(0.4, 0.2, 0.6, 1) })
    );
  }, [piece, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * (height + 48) }, { rotate: `${progress.value * 720}deg` }],
    opacity: progress.value >= 1 ? 0 : 0.95
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: -24,
          left: `${piece.left}%`,
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 0.5,
          backgroundColor: piece.color,
          borderRadius: piece.round ? piece.size / 2 : 2
        },
        style
      ]}
    />
  );
}

/**
 * Full-screen falling confetti (prototype `confetti()`), re-fired whenever
 * `seed` changes. Pointer-transparent — render it over anything.
 */
export function Confetti({ seed, count = 46 }: { seed: number; count?: number }) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const pieces = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    for (let i = 0; i < count; i += 1) {
      out.push({
        key: `${seed}_${i}`,
        left: Math.random() * 100,
        duration: 1100 + Math.random() * 1200,
        delay: Math.random() * 500,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0
      });
    }
    return out;
  }, [seed, count]);

  if (reduced || seed === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}
    >
      {pieces.map((piece) => (
        <PieceView key={piece.key} piece={piece} height={height} />
      ))}
    </View>
  );
}
