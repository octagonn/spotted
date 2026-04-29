import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
};

export function Screen({ children, scroll = true, className }: ScreenProps) {
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return (
      <View className={`flex-1 bg-black ${className ?? ""}`} style={{ paddingTop: insets.top }}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerClassName={`px-4 pb-32 ${className ?? ""}`}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={{ height: insets.top + 16 }} />
      {children}
    </ScrollView>
  );
}
