import { Dimensions, View } from "react-native";

const { width, height } = Dimensions.get("window");

function StaticOrb({ x, y, size, opacity }: { x: number; y: number; size: number; opacity: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#FFFFFF",
        opacity
      }}
    />
  );
}

function StaticGrid({ step = 110, opacity = 0.04 }: { step?: number; opacity?: number }) {
  const rows = [];
  for (let y = 0; y < height + 100; y += step) {
    rows.push(
      <View
        key={`h-${y}`}
        style={{ position: "absolute", top: y, left: 0, right: 0, height: 1, backgroundColor: "#FFFFFF" }}
      />
    );
  }
  for (let x = 0; x < width + 100; x += step) {
    rows.push(
      <View
        key={`v-${x}`}
        style={{ position: "absolute", top: 0, bottom: 0, left: x, width: 1, backgroundColor: "#FFFFFF" }}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity }}
    >
      {rows}
    </View>
  );
}

function CornerRing({ size, top, left, right, bottom, opacity }: {
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  opacity: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        ...(top !== undefined ? { top } : {}),
        ...(left !== undefined ? { left } : {}),
        ...(right !== undefined ? { right } : {}),
        ...(bottom !== undefined ? { bottom } : {}),
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: "#FFFFFF",
        opacity
      }}
    />
  );
}

export function StaticAuroraBackground() {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <StaticGrid />
      <StaticOrb x={-width * 0.25} y={height * 0.1} size={width * 0.7} opacity={0.06} />
      <StaticOrb x={width * 0.45} y={height * 0.55} size={width * 0.55} opacity={0.05} />
      <StaticOrb x={-width * 0.1} y={height * 0.78} size={width * 0.45} opacity={0.04} />
      <CornerRing size={width * 0.9} top={-width * 0.4} right={-width * 0.45} opacity={0.07} />
      <CornerRing size={width * 0.7} bottom={-width * 0.35} left={-width * 0.3} opacity={0.05} />
    </View>
  );
}
