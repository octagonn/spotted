import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { Camera, CircleDot, MapPin, MessageCircle, User } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GrainOverlay } from "@/components/GrainOverlay";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePresenceStore } from "@/stores/presence";
import { colors } from "@/theme/colors";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? colors.white : colors.slate;
  if (name === "feed") {
    return <CircleDot color={color} size={23} strokeWidth={1.8} />;
  }
  if (name === "map") {
    return <MapPin color={color} size={23} strokeWidth={1.8} />;
  }
  if (name === "friends") {
    return <MessageCircle color={color} size={23} strokeWidth={1.8} />;
  }
  if (name === "profile") {
    return <User color={color} size={23} strokeWidth={1.8} />;
  }
  return <Camera color={colors.black} size={28} strokeWidth={2.4} />;
}

function SpottedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const atGym = usePresenceStore((store) => store.atGym);

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-iron bg-black px-3 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <GrainOverlay opacity={0.05} />
      <View className="flex-row items-end justify-between">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          if (route.name === "index" || route.name === "explore") {
            return null;
          }
          const isCamera = route.name === "camera";
          return (
            <Pressable
              key={route.key}
              className={
                isCamera
                  ? "-mt-8 h-16 w-16 items-center justify-center bg-white"
                  : "h-14 flex-1 items-center justify-center gap-1"
              }
              pressedClassName={isCamera ? "scale-95" : "opacity-60"}
              onPress={() => navigation.navigate(route.name)}
              testID={`tab-${route.name}`}
              accessibilityRole="button"
              accessibilityLabel={String(options?.title ?? route.name)}
            >
              {isCamera && atGym ? <View className="absolute inset-[-5px] border border-mist opacity-60" /> : null}
              <TabIcon name={route.name} focused={focused} />
              {!isCamera ? (
                <Text variant="micro" className={focused ? "text-white" : "text-slate"}>
                  {String(options?.title ?? route.name).toUpperCase()}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <SpottedTabBar {...props} />} screenOptions={{ headerShown: false, lazy: false }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="feed" options={{ title: "Today" }} />
      <Tabs.Screen name="map" options={{ title: "Gym" }} />
      <Tabs.Screen name="camera" options={{ title: "Check In" }} />
      <Tabs.Screen name="friends" options={{ title: "Inbox" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
