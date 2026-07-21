import { useRouter, type Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { View, type ViewStyle } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/**
 * Standalone back-arrow circle (matches PanelHeader's) for screens that render
 * without a native header. Falls back to a route if there's no history.
 */
export function BackButton({ fallback = "/(tabs)/feed", style }: { fallback?: Href; style?: ViewStyle }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      accessibilityLabel="Back"
      hitSlop={8}
      style={style}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.iron,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <ChevronLeft color={colors.mist} size={18} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}
