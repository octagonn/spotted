import type { ReactNode } from "react";
import { View } from "react-native";

import { GrainOverlay } from "@/components/GrainOverlay";

type SheetProps = {
  children: ReactNode;
  className?: string;
};

export function Sheet({ children, className }: SheetProps) {
  return (
    <View className={`overflow-hidden rounded-t-sheet border border-iron bg-graphite ${className ?? ""}`}>
      <GrainOverlay opacity={0.04} />
      <View className="items-center pt-3">
        <View className="h-px w-12 bg-iron" />
      </View>
      {children}
    </View>
  );
}
