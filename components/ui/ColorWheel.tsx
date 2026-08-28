import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { colors } from "@/theme/colors";

// ------------------------------------------------------------------ color math

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Wedge path for one hue slice of the wheel. */
function wedge(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`;
}

const SLICES = 72;

/**
 * HSV color wheel: angle = hue, distance from center = saturation, plus a
 * brightness bar underneath. Drag anywhere on the wheel. Emits hex on change.
 * Pure SVG + gesture-handler — no native module beyond what the app already
 * ships.
 */
export function ColorWheel({
  value,
  onChange,
  size = 220
}: {
  value: string | null;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const initial = value ? hexToHsv(value) : { h: 40, s: 0.7, v: 0.95 };
  const [hsv, setHsv] = useState(initial);
  const [barWidth, setBarWidth] = useState(0);

  const r = size / 2;
  const wedges = useMemo(() => {
    const step = 360 / SLICES;
    return Array.from({ length: SLICES }, (_, i) => ({
      d: wedge(r, r, r, i * step, (i + 1) * step + 0.6),
      fill: hsvToHex(i * step, 1, 1)
    }));
  }, [r]);

  const commit = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  const pickFromPoint = (x: number, y: number) => {
    const dx = x - r;
    const dy = y - r;
    const dist = Math.min(Math.hypot(dx, dy), r);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    commit({ h: angle % 360, s: dist / r, v: hsv.v });
  };

  const pickBrightness = (x: number) => {
    if (barWidth <= 0) return;
    commit({ ...hsv, v: Math.max(0.15, Math.min(1, x / barWidth)) });
  };

  const wheelGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(pickFromPoint)(e.x, e.y))
    .onUpdate((e) => runOnJS(pickFromPoint)(e.x, e.y));
  const barGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(pickBrightness)(e.x))
    .onUpdate((e) => runOnJS(pickBrightness)(e.x));

  // Marker position from the current HSV.
  const rad = ((hsv.h - 90) * Math.PI) / 180;
  const mx = r + hsv.s * r * Math.cos(rad);
  const my = r + hsv.s * r * Math.sin(rad);
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <View style={{ alignItems: "center", gap: 16 }}>
      <GestureDetector gesture={wheelGesture}>
        <View style={{ width: size, height: size }} accessibilityLabel="Color wheel" accessibilityRole="adjustable">
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="sat" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {wedges.map((w, i) => (
              <Path key={i} d={w.d} fill={w.fill} />
            ))}
            <Circle cx={r} cy={r} r={r} fill="url(#sat)" />
            {/* Brightness dims the whole wheel so the preview matches. */}
            <Circle cx={r} cy={r} r={r} fill="#000000" fillOpacity={1 - hsv.v} />
            <Circle cx={mx} cy={my} r={11} fill={hex} stroke="#FFFFFF" strokeWidth={3} />
            <Circle cx={mx} cy={my} r={13} fill="none" stroke="#000000" strokeOpacity={0.35} strokeWidth={1} />
          </Svg>
        </View>
      </GestureDetector>

      <GestureDetector gesture={barGesture}>
        <View
          onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="Brightness"
          accessibilityRole="adjustable"
          style={{ alignSelf: "stretch", height: 28, justifyContent: "center" }}
        >
          <View style={{ height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row", borderWidth: 1, borderColor: colors.iron }}>
            {Array.from({ length: 24 }, (_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: hsvToHex(hsv.h, hsv.s, 0.15 + (0.85 * i) / 23) }} />
            ))}
          </View>
          {barWidth > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: Math.max(0, Math.min(barWidth - 20, ((hsv.v - 0.15) / 0.85) * barWidth - 10)),
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: hex,
                borderWidth: 3,
                borderColor: colors.white
              }}
            />
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}
