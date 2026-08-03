import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import { Camera, Dumbbell, House, Send, User } from "lucide-react-native";
import { Pressable as RNPressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { selectionHaptic } from "@/lib/haptics";
import { useTabActions } from "@/stores/tabActions";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const NAV_H = 84;

type TabName = "feed" | "friends" | "map" | "profile";

/** Tab order per spec §3: Home · Friends · Camera (center) · Map · Profile. */
const LEFT_TABS: TabName[] = ["feed", "friends"];
const RIGHT_TABS: TabName[] = ["map", "profile"];

/** Human-readable names for screen readers (route names are internal). */
const TAB_LABELS: Record<TabName, string> = {
  feed: "Home",
  friends: "Friends",
  map: "Gym map",
  profile: "Profile"
};

function TabIcon({ name, focused }: { name: TabName; focused: boolean }) {
  const color = focused ? tokens.text.primary : tokens.text.tertiary;
  const size = 28;
  if (name === "feed") return <House color={color} size={size} strokeWidth={2} />;
  if (name === "friends") return <Send color={color} size={size} strokeWidth={2} />;
  if (name === "map") return <Dumbbell color={color} size={size} strokeWidth={2} />;
  return <User color={color} size={size} strokeWidth={2} />;
}

function TabSlot({
  name,
  focused,
  onPress
}: {
  name: TabName;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <RNPressable
      onPress={() => {
        void selectionHaptic();
        onPress();
      }}
      testID={`tab-${name}`}
      accessibilityRole="button"
      accessibilityLabel={TAB_LABELS[name]}
      accessibilityState={{ selected: focused }}
      hitSlop={8}
      style={({ pressed }) => ({
        // ≥48×48 hit target per sizing spec.
        width: 52,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.9 : 1 }]
      })}
    >
      <TabIcon name={name} focused={focused} />
    </RNPressable>
  );
}

/**
 * Center camera button: 76px circle raised above the row, 1.5px border.strong
 * ring, ink bg, white 28px camera icon. Pushes /camera instead of switching
 * tabs.
 */
function CameraTabButton({ onPress }: { onPress: () => void }) {
  return (
    <RNPressable
      onPress={() => {
        void selectionHaptic();
        onPress();
      }}
      testID="tab-camera"
      accessibilityRole="button"
      accessibilityLabel="Camera"
      style={({ pressed }) => ({
        // Negative margin drops the big circle below the side icons' baseline
        // so its bottom hugs the home indicator like the rest of the bar.
        marginBottom: -10,
        transform: [{ scale: pressed ? 0.92 : 1 }]
      })}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: tokens.border.strong,
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000000",
          shadowOpacity: 0.9,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 14
        }}
      >
        <Camera color={tokens.text.primary} size={28} strokeWidth={2} />
      </View>
    </RNPressable>
  );
}

function RedesignTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isFocused = (name: TabName) => state.routes[state.index]?.name === name;
  const bumpFeedReset = useTabActions((s) => s.bumpFeedReset);
  const goTo = (name: TabName) => {
    // Re-tapping the already-focused Home tab scrolls to top + refreshes.
    if (name === "feed" && isFocused("feed")) {
      bumpFeedReset();
      return;
    }
    navigation.navigate(name);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: NAV_H + insets.bottom,
        zIndex: 100,
        elevation: 100
      }}
    >
      {/* linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.92) 34%, black 100%) */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)", "#000000"]}
        locations={[0, 0.34, 1]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        pointerEvents="box-none"
        style={{
          // Anchored to the bottom edge (previously top-aligned inside the
          // 84px bar, which left ~46px of dead space under the icons).
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-around",
          paddingHorizontal: 18,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 2 : 14
        }}
      >
        {LEFT_TABS.map((name) => (
          <TabSlot key={name} name={name} focused={isFocused(name)} onPress={() => goTo(name)} />
        ))}
        <CameraTabButton onPress={() => router.push("/camera")} />
        {RIGHT_TABS.map((name) => (
          <TabSlot key={name} name={name} focused={isFocused(name)} onPress={() => goTo(name)} />
        ))}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <RedesignTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: false, sceneStyle: { backgroundColor: colors.black } }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="feed" options={{ title: "Home" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
