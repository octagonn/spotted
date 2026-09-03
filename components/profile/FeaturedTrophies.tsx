import { Trophy } from "lucide-react-native";
import { View } from "react-native";

import { PROFILE_GUTTER } from "@/components/profile/ProfileIdentity";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type FeaturedTrophy = { icon: string; name: string; familyName: string | null };

/** Up to three pinned trophies as gold chips — achievement is what gold is for. */
export function FeaturedTrophies({ trophies, onPress }: { trophies: FeaturedTrophy[]; onPress: () => void }) {
  if (trophies.length === 0) return null;
  return (
    <Pressable
      onPress={onPress}
      haptic="none"
      accessibilityLabel="Featured trophies"
      style={{
        flexDirection: "row",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: space[2],
        paddingHorizontal: PROFILE_GUTTER
      }}
    >
      {trophies.slice(0, 3).map((t, i) => (
        <View
          key={`${t.name}-${i}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[1] + 2,
            paddingVertical: space[1] + 2,
            paddingHorizontal: space[3],
            borderRadius: radius.pill,
            backgroundColor: tokens.accent.goldSubtle
          }}
        >
          <Trophy size={12} color={tokens.accent.gold} strokeWidth={icon.stroke.regular} />
          <Text variant="label" numberOfLines={1} className="text-gold max-w-[96px]">
            {t.name}
          </Text>
        </View>
      ))}
    </Pressable>
  );
}
