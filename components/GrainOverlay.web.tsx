import { View } from "react-native";

type GrainOverlayProps = {
  opacity?: number;
};

const dots = Array.from({ length: 28 }, (_, index) => ({
  left: ["left-3", "left-14", "left-28", "left-44", "left-64"][index % 5],
  top: ["top-4", "top-20", "top-36", "top-56", "top-72", "top-96"][index % 6]
}));

function opacityClass(opacity: number) {
  if (opacity >= 0.05) {
    return "opacity-5";
  }
  if (opacity >= 0.04) {
    return "opacity-[0.04]";
  }
  return "opacity-[0.035]";
}

export function GrainOverlay({ opacity = 0.035 }: GrainOverlayProps) {
  return (
    <View className={["pointer-events-none absolute inset-0", opacityClass(opacity)].join(" ")}>
      {dots.map((dot, index) => (
        <View
          key={`${dot.left}-${dot.top}-${index}`}
          className={["absolute h-px w-px bg-pure", dot.left, dot.top].join(" ")}
        />
      ))}
    </View>
  );
}
