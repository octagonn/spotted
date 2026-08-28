import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter } from "expo-router";
import { Camera, House, Send, User, Users } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable as RNPressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInboxThreads } from "@/components/friends/useInboxThreads";
import { useMessageRequests } from "@/hooks/queries/useMessagesExtras";
import { selectionHaptic } from "@/lib/haptics";
import { useTabActions } from "@/stores/tabActions";
import { colors } from "@/theme/colors";

// Apple's real Liquid Glass (iOS 26 UIGlassEffect) via expo-glass-effect —
// lazy-required AND capability-probed inside try/catch: in Expo Go or builds
// made before the module existed, either the require or the availability call
// throws — both cases must fall back to the BlurView bar, never crash.
let Glass: typeof import("expo-glass-effect") | null = null;
let liquidGlassAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Glass = require("expo-glass-effect");
  liquidGlassAvailable = Glass?.isLiquidGlassAvailable() ?? false;
} catch {
  Glass = null;
  liquidGlassAvailable = false;
}

type TabName = "feed" | "friends" | "map" | "profile";

/** Tab order per spec §3: Home · Friends · Camera (center) · Map · Profile. */
const TABS: (TabName | "camera")[] = ["feed", "friends", "camera", "map", "profile"];

/** Human-readable names for screen readers (route names are internal). */
const TAB_LABELS: Record<TabName | "camera", string> = {
  feed: "Home",
  friends: "Friends",
  camera: "Camera",
  map: "Communities",
  profile: "Profile"
};

function TabIcon({ name, focused }: { name: TabName | "camera"; focused: boolean }) {
  const color = focused ? "#FFFFFF" : "rgba(255,255,255,0.62)";
  const size = 25;
  if (name === "feed") return <House color={color} size={size} strokeWidth={2.1} />;
  if (name === "friends") return <Send color={color} size={size} strokeWidth={2.1} />;
  if (name === "camera") return <Camera color={color} size={size} strokeWidth={2.1} />;
  if (name === "map") return <Users color={color} size={size} strokeWidth={2.1} />;
  return <User color={color} size={size} strokeWidth={2.1} />;
}

function TabSlot({
  name,
  focused,
  dot = false,
  onPress
}: {
  name: TabName | "camera";
  focused: boolean;
  /** Small red activity dot (unread DMs), IG-style at the icon's corner. */
  dot?: boolean;
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
      accessibilityLabel={dot ? `${TAB_LABELS[name]}, new activity` : TAB_LABELS[name]}
      accessibilityState={{ selected: focused }}
      hitSlop={6}
      // Fixed-size slot, centered content — the ROW distributes the slots
      // (space-evenly), so leftover width can never pool on one side.
      style={({ pressed }) => ({
        width: 60,
        height: 62,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.9 : 1 }]
      })}
    >
      {/* Active pill highlight — the IG-style lighter capsule behind the icon. */}
      <View
        style={{
          width: 56,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? "rgba(255,255,255,0.17)" : "transparent"
        }}
      >
        <View style={{ width: 25, height: 25, alignItems: "center", justifyContent: "center" }}>
          <TabIcon name={name} focused={focused} />
          {dot ? (
            <View
              style={{
                position: "absolute",
                bottom: -3,
                right: -6,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: "#FF3B30"
              }}
            />
          ) : null}
        </View>
      </View>
    </RNPressable>
  );
}

/** Row inset (slots are fixed-width; space-evenly distributes the leftover). */
const ROW_PAD = 4;

/**
 * The five slots, symmetrically distributed — shared by both glass branches.
 * IG-style scrub: HOLD anywhere on the bar and a glass highlight appears and
 * follows the finger across the tabs; release commits the tab under it.
 * Quick taps are untouched (the pan only activates after a long press).
 */
function TabRow({
  isFocused,
  hasUnreadDm,
  goTo
}: {
  isFocused: (name: TabName) => boolean;
  hasUnreadDm: boolean;
  goTo: (name: TabName | "camera") => void;
}) {
  const [rowW, setRowW] = useState(0);
  // React mirror of the drag state — while scrubbing, the STATIC focused-tab
  // highlight hides so only the finger's capsule is lit.
  const [scrubbing, setScrubbing] = useState(false);
  const dragging = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragIndex = useSharedValue(0);

  const commit = (i: number) => {
    setScrubbing(false);
    goTo(TABS[Math.max(0, Math.min(TABS.length - 1, i))]);
  };
  const tick = () => void selectionHaptic();
  const beginScrub = () => {
    setScrubbing(true);
    void selectionHaptic();
  };
  const endScrub = () => setScrubbing(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart((e) => {
      "worklet";
      const span = rowW > 0 ? rowW / TABS.length : 1;
      dragIndex.value = Math.max(0, Math.min(TABS.length - 1, Math.floor(e.x / span)));
      dragX.value = Math.max(ROW_PAD + 28, Math.min(rowW - ROW_PAD - 28, e.x));
      dragging.value = 1;
      runOnJS(beginScrub)();
    })
    .onUpdate((e) => {
      "worklet";
      const span = rowW > 0 ? rowW / TABS.length : 1;
      // The capsule follows the FINGER exactly; the index (haptic tick +
      // release target) tracks which slot it's over.
      dragX.value = Math.max(ROW_PAD + 28, Math.min(rowW - ROW_PAD - 28, e.x));
      const next = Math.max(0, Math.min(TABS.length - 1, Math.floor(e.x / span)));
      if (next !== dragIndex.value) {
        dragIndex.value = next;
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      "worklet";
      dragging.value = 0;
      runOnJS(commit)(dragIndex.value);
    })
    .onFinalize(() => {
      "worklet";
      dragging.value = 0;
      runOnJS(endScrub)();
    });

  const scrubPillStyle = useAnimatedStyle(() => ({
    opacity: dragging.value,
    transform: [
      { translateX: dragX.value - 28 },
      { scale: withSpring(dragging.value ? 1.06 : 0.9, { damping: 18, stiffness: 280 }) }
    ]
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-evenly",
          height: 62,
          paddingHorizontal: ROW_PAD
        }}
      >
        {/* Scrub highlight — brighter glass capsule gliding under the finger. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 11,
              left: 0,
              width: 56,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.26)"
            },
            scrubPillStyle
          ]}
        />
        {TABS.map((name) => (
          <TabSlot
            key={name}
            name={name}
            // While scrubbing, ONLY the finger capsule is highlighted.
            focused={!scrubbing && name !== "camera" && isFocused(name as TabName)}
            dot={name === "friends" && hasUnreadDm}
            onPress={() => goTo(name)}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

/**
 * Instagram-style floating glass pill: dark translucent blur, fully rounded,
 * hovering above the home indicator; the focused tab sits in a lighter
 * capsule. Same five actions as before (camera pushes /camera).
 */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Red dot on the DMs tab whenever any thread is unread or a request waits.
  const inbox = useInboxThreads();
  const messageRequests = useMessageRequests();
  const hasUnreadDm =
    (inbox.data ?? []).some((thread) => thread.unread) || (messageRequests.data ?? []).length > 0;

  const isFocused = (name: TabName) => state.routes[state.index]?.name === name;
  const bumpFeedReset = useTabActions((s) => s.bumpFeedReset);
  const goTo = (name: TabName | "camera") => {
    if (name === "camera") {
      router.push("/camera");
      return;
    }
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
        zIndex: 100,
        elevation: 100
      }}
    >
      {/* Shadow lives on an unclipped wrapper; the blur clips to the pill. */}
      <View
        style={{
          marginHorizontal: 18,
          marginBottom: insets.bottom > 0 ? insets.bottom + 4 : 16,
          borderRadius: 999,
          shadowColor: "#000000",
          shadowOpacity: 0.55,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 18
        }}
      >
        {Glass && liquidGlassAvailable ? (
          /* iOS 26+: Apple's own Liquid Glass material. The native effect view
             must NOT own the row layout (its content view doesn't reliably
             forward flex styles — icons piled left with dead space right);
             a plain inner View does the laying out. */
          <Glass.GlassView
            glassEffectStyle="regular"
            isInteractive
            style={{ borderRadius: 999, overflow: "hidden" }}
          >
            <TabRow
              isFocused={isFocused}
              hasUnreadDm={hasUnreadDm}
              goTo={goTo}
            />
          </Glass.GlassView>
        ) : (
          /* Pre-iOS-26 / Android fallback: the most transparent system
             material with barely any smoke. */
          <View
            style={{
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)"
            }}
          >
            <BlurView
              intensity={100}
              tint={Platform.OS === "ios" ? "systemUltraThinMaterialDark" : "dark"}
              style={{
                backgroundColor: Platform.OS === "ios" ? "rgba(14,14,18,0.08)" : "rgba(16,16,20,0.6)"
              }}
            >
              {/* Top-edge sheen — the light catching the glass. */}
              <LinearGradient
                colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.02)", "transparent"]}
                locations={[0, 0.35, 1]}
                pointerEvents="none"
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 30 }}
              />
              <TabRow
                isFocused={isFocused}
                hasUnreadDm={hasUnreadDm}
                goTo={goTo}
              />
            </BlurView>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
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
