import { Canvas, Circle, Fill } from "@shopify/react-native-skia";
import { View } from "react-native";

import { colors } from "@/theme/colors";

type GrainOverlayProps = {
  opacity?: number;
};

const points = Array.from({ length: 42 }, (_, index) => ({
  x: (index * 37) % 393,
  y: (index * 71) % 852,
  r: 0.35 + (index % 3) * 0.18
}));

export function GrainOverlay({ opacity = 0.035 }: GrainOverlayProps) {
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Canvas style={{ flex: 1 }}>
        <Fill color={colors.black} opacity={0.01} />
        {points.map((point) => (
          <Circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r={point.r}
            color={colors.pure}
            opacity={opacity}
          />
        ))}
      </Canvas>
    </View>
  );
}
