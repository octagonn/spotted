import { ChevronDown } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { TrophyCard } from "@/components/trophies/TrophyCard";
import { TrophyGrid } from "@/components/trophies/TrophyGrid";
import { Pressable } from "@/components/ui/Pressable";
import { type CategorySection } from "@/lib/trophySelectors";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

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
    rotation.value = withTiming(collapsed ? -90 : 0, { duration: 200 });
  }, [collapsed, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <>
      <Pressable
        onPress={() => onToggle(section.category)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${section.label}, ${earnedCount} of ${section.cards.length} earned`}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 10 }}>
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.14, textTransform: "uppercase", color: colors.fog }}>
            {section.label}
          </Text>
          <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 10.5, color: earnedCount > 0 ? tokens.accent.gold : colors.slate }}>
            {earnedCount}/{section.cards.length}
          </Text>
          <View style={{ flex: 1 }} />
          <Animated.View style={chevronStyle}>
            <ChevronDown size={15} color={colors.fog} strokeWidth={2} />
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
