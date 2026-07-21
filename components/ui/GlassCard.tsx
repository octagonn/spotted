import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, View } from "react-native";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  intensity?: number;
  tint?: "dark" | "light" | "default";
};

export function GlassCard({ children, className, intensity = 24, tint = "dark" }: GlassCardProps) {
  if (Platform.OS === "android" || Platform.OS === "web") {
    return (
      <View
        className={`overflow-hidden rounded-card border border-hairline-strong bg-glass-strong ${className ?? ""}`}
      >
        {children}
      </View>
    );
  }
  return (
    <View className={`overflow-hidden rounded-card border border-hairline-strong ${className ?? ""}`}>
      <BlurView intensity={intensity} tint={tint} className="absolute inset-0" />
      <View className="bg-glass-soft">{children}</View>
    </View>
  );
}
