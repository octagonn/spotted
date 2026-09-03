import { Activity, Dumbbell, Flame } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "@/theme/colors";
import { icon, radius, tokens } from "@/theme/tokens";

export type ExerciseKind = "lift" | "cardio" | "sports";

export function exerciseKind(kind: "lift" | "cardio", muscle?: string): ExerciseKind {
  if (muscle === "Sports") return "sports";
  return kind;
}

/**
 * Square icon tile for an exercise. One neutral treatment for lifts, cardio and
 * sports — the glyph carries the difference, not a feature color.
 * `inverted` = sitting on a white (selected) row.
 */
export function ExerciseIcon({
  kind,
  size = 44,
  inverted = false
}: {
  kind: ExerciseKind;
  size?: number;
  inverted?: boolean;
}) {
  const Icon = kind === "sports" ? Activity : kind === "cardio" ? Flame : Dumbbell;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: inverted ? colors.hairline : tokens.bg.subtle,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Icon
        size={size >= 44 ? icon.size.sm : icon.size.xs}
        color={inverted ? colors.black : tokens.text.primary}
        strokeWidth={icon.stroke.thin}
      />
    </View>
  );
}
