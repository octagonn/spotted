import { Image, View } from "react-native";
import { User } from "lucide-react-native";

import { colors } from "@/theme/colors";

type AvatarProps = {
  uri?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  rounded?: "square" | "circle";
  muted?: boolean;
};

const sizes = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-24 w-24"
} as const;

const iconSizes = {
  xs: 16,
  sm: 18,
  md: 24,
  lg: 40
} as const;

export function Avatar({ uri, size = "md", rounded = "square", muted }: AvatarProps) {
  const radius = rounded === "circle" ? "rounded-full" : "rounded";
  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={`${sizes[size]} ${radius} border border-iron bg-graphite ${muted ? "opacity-40" : ""}`}
      />
    );
  }
  return (
    <View className={`${sizes[size]} ${radius} items-center justify-center border border-iron bg-graphite`}>
      <User color={colors.silver} size={iconSizes[size]} strokeWidth={1.5} />
    </View>
  );
}
