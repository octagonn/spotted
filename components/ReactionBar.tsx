import { useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { selectionHaptic } from "@/lib/haptics";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";

const reactions = ["🔥", "💪", "😍", "👀", "💀"] as const;

type Reaction = (typeof reactions)[number];

type ReactionBarProps = {
  onReact?: (reaction: Reaction) => Promise<void> | void;
};

export function ReactionBar({ onReact }: ReactionBarProps) {
  const [active, setActive] = useState<Reaction | null>(null);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  async function handlePress(reaction: Reaction) {
    setActive(reaction);
    scale.value = withSequence(withTiming(1.4, { duration: 110 }), withTiming(1, { duration: 110 }));
    await selectionHaptic();
    await onReact?.(reaction);
  }

  return (
    <View className="h-16 flex-row items-center justify-around border-t border-iron bg-black/80">
      {reactions.map((reaction) => (
        <Pressable
          key={reaction}
          className="h-12 w-12 items-center justify-center"
          haptic={false}
          onPress={() => handlePress(reaction)}
        >
          <Animated.View style={active === reaction ? animatedStyle : undefined}>
            <Text variant="body-xl" className={active === reaction ? "text-white" : "text-mist"}>
              {reaction}
            </Text>
          </Animated.View>
        </Pressable>
      ))}
    </View>
  );
}
