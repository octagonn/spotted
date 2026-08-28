import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  /** Skip the opaque black background — for screens that render over the
   *  shared ambient video background (auth/onboarding flow). */
  transparent?: boolean;
};

export function Screen({ children, scroll = true, className, transparent = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bg = transparent ? "" : "bg-black";
  if (!scroll) {
    return (
      <View className={`flex-1 ${bg} ${className ?? ""}`} style={{ paddingTop: insets.top }}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      className={`flex-1 ${bg}`}
      contentContainerClassName={`px-4 pb-32 ${className ?? ""}`}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={{ height: insets.top + 16 }} />
      {children}
    </ScrollView>
  );
}
