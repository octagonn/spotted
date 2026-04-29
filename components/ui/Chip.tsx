import type { ReactNode } from "react";

import { Text } from "@/components/ui/Text";
import { Pressable } from "@/components/ui/Pressable";

type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ children, selected, onPress }: ChipProps) {
  return (
    <Pressable
      className={`min-h-9 justify-center rounded-spotted border px-3 ${
        selected ? "border-white bg-white" : "border-iron bg-ink"
      }`}
      onPress={onPress}
    >
      <Text variant="micro" className={selected ? "text-black" : "text-silver"}>
        {children}
      </Text>
    </Pressable>
  );
}
