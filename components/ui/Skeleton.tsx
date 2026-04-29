import { View } from "react-native";

import { Text } from "@/components/ui/Text";

type SkeletonProps = {
  word?: string;
};

export function Skeleton({ word = "LOADING" }: SkeletonProps) {
  return (
    <View className="min-h-64 justify-end border border-iron bg-ink p-6">
      <Text variant="title" className="text-slate">
        {word}
      </Text>
      <View className="mt-6 h-px bg-iron" />
    </View>
  );
}
