import { ChevronDown } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { TrophyCard } from "@/components/trophies/TrophyCard";
import { TrophyGrid } from "@/components/trophies/TrophyGrid";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { type CategorySection } from "@/lib/trophySelectors";
import { durations } from "@/theme/motion";
import { icon, space, tokens } from "@/theme/tokens";

/**
 * A collapsible category section (5b): the header is a tap target with a
 * rotating chevron and an earned/total count, so collapsed sections still
 * read at a glance ("Consistency — 4/12"). Height animates via
 * LayoutAnimation (configured by the parent on toggle); the chevron rotates
 * on the UI thread via Reanimated.
 */
export function TrophyCategorySection({
  section,
  cardWidth,
  collapsed,
  onToggle,
  onOpen
}: {
  section: CategorySection;
  cardWidth: number;
  collapsed: boolean;
  onToggle: (category: string) => void;
  onOpen: (trophyId: string) => void;
}) {
  const earnedCount = section.cards.filter((card) => card.earnedAt).length;

  const rotation = useSharedValue(collapsed ? -90 : 0);
  useEffect(() => {
    rotation.value = withTiming(collapsed ? -90 : 0, { duration: durations.color });
  }, [collapsed, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <>
      <Pressable
        onPress={() => onToggle(section.category)}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${section.label}, ${earnedCount} of ${section.cards.length} earned`}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            paddingHorizontal: space[4] + 2,
            paddingTop: space[4] + 4,
            paddingBottom: space[2] + 2
          }}
        >
          <Text variant="micro" accessibilityRole="header">
            {section.label}
          </Text>
          <Text variant="mono" className={earnedCount > 0 ? "text-gold" : "text-slate"}>
            {`${earnedCount}/${section.cards.length}`}
          </Text>
          <View style={{ flex: 1 }} />
          <Animated.View style={chevronStyle}>
            <ChevronDown size={icon.size.xs - 1} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
          </Animated.View>
        </View>
      </Pressable>
      {collapsed ? null : (
        <TrophyGrid>
          {section.cards.map((card) => (
            <TrophyCard key={card.def.id} card={card} width={cardWidth} onPress={() => onOpen(card.def.id)} />
          ))}
        </TrophyGrid>
      )}
    </>
  );
}
