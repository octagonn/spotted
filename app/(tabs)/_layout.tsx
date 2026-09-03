import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
  type MaterialTopTabNavigationEventMap,
  type MaterialTopTabNavigationOptions
} from "@react-navigation/material-top-tabs";
import type { ParamListBase, TabNavigationState } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { useRouter, withLayoutContext } from "expo-router";
import { Camera, House, Send, User, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInboxThreads } from "@/components/friends/useInboxThreads";
import { Pressable } from "@/components/ui/Pressable";
import { useMessageRequests } from "@/hooks/queries/useMessagesExtras";
import { haptic } from "@/lib/haptics";
import { useTabActions } from "@/stores/tabActions";
import { colors } from "@/theme/colors";
import { TAB_BAR_FLOAT_GAP, TAB_BAR_ROW_HEIGHT } from "@/theme/layout";
import { durations, easing, springs } from "@/theme/motion";
import { icon, radius, tokens } from "@/theme/tokens";

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

/**
 * Native pager tabs: the scenes live in a react-native-pager-view, so a swipe
 * sticks to the finger (Instagram/Snapchat) instead of animating after a
 * fling. Expo Router wraps the navigator so the (tabs) routes are unchanged.
 */
const { Navigator } = createMaterialTopTabNavigator();
const MaterialTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

/** Land on the feed when (tabs) is entered without a child route. */
export const unstable_settings = { initialRouteName: "feed" };

type TabName = "feed" | "friends" | "map" | "profile";
type SlotName = TabName | "camera";

/** Tab order: Home · Friends · Camera (center action) · Map · Profile. */
const TABS: SlotName[] = ["feed", "friends", "camera", "map", "profile"];

/** Human-readable names for screen readers (route names are internal). */
const TAB_LABELS: Record<SlotName, string> = {
  feed: "Home",
  friends: "Friends",
  camera: "Camera",
  map: "Communities",
  profile: "Profile"
};

/* ------------------------------ geometry ------------------------------ */

/** Pill row height (shared with theme/layout so screens can clear it). */
const ROW_H = TAB_BAR_ROW_HEIGHT;
/** Fixed slot width; the row distributes leftover space evenly. */
const SLOT_W = 60;
/** Row inset. */
const ROW_PAD = 4;
/** Selected / scrub capsule behind an icon. */
const CAPSULE_W = 52;
const CAPSULE_H = 38;

/* -------------------------------- colors ------------------------------- */

const ICON_ACTIVE = colors.white;
const ICON_INACTIVE = colors.silver;
/** Capsule tints over glass — palette overlays, no ad-hoc rgba. */
const CAPSULE_SELECTED = colors.glassStrong;
const CAPSULE_SCRUB = colors.hairlineStrong;

function TabIcon({ name, focused }: { name: SlotName; focused: boolean }) {
  // The camera is an action, so it's always drawn in the active white weight.
  const active = focused || name === "camera";
  const color = active ? ICON_ACTIVE : ICON_INACTIVE;
  const size = icon.size.lg;
  const strokeWidth = active ? icon.stroke.bold : icon.stroke.regular;
  if (name === "feed") return <House color={color} size={size} strokeWidth={strokeWidth} />;
  if (name === "friends") return <Send color={color} size={size} strokeWidth={strokeWidth} />;
  if (name === "camera") return <Camera color={color} size={size} strokeWidth={strokeWidth} />;
  if (name === "map") return <Users color={color} size={size} strokeWidth={strokeWidth} />;
  return <User color={color} size={size} strokeWidth={strokeWidth} />;
}

/**
 * A destination slot. The selected capsule fades in/out with the standard
 * color duration (instant under reduced motion) instead of snapping.
 */
function TabSlot({
  name,
  focused,
  dot = false,
  onPress
}: {
  name: SlotName;
  focused: boolean;
  /** Activity dot (unread DMs / pending requests) at the icon's corner. */
  dot?: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const selected = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    selected.value = reducedMotion
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, { duration: durations.color, easing: easing.standard });
  }, [focused, reducedMotion, selected]);

  const capsuleStyle = useAnimatedStyle(() => ({ opacity: selected.value }));

  return (
    <Pressable
      onPress={onPress}
      haptic={name === "camera" ? "impact" : "selection"}
      pressScale={0.9}
      pressOpacity={1}
      hitSlop={6}
      testID={`tab-${name}`}
      accessibilityRole={name === "camera" ? "button" : "tab"}
      accessibilityLabel={dot ? `${TAB_LABELS[name]}, new activity` : TAB_LABELS[name]}
      accessibilityState={{ selected: focused }}
      style={{ width: SLOT_W, height: ROW_H, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: CAPSULE_W,
            height: CAPSULE_H,
            borderRadius: radius.pill,
            backgroundColor: CAPSULE_SELECTED
          },
          capsuleStyle
        ]}
      />
      <View style={{ width: icon.size.lg, height: icon.size.lg, alignItems: "center", justifyContent: "center" }}>
        <TabIcon name={name} focused={focused} />
        {dot ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              width: 8,
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: tokens.status.danger
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The five slots, symmetrically distributed — shared by both glass branches.
 * Scrub: HOLD anywhere on the bar and a capsule follows the finger across the
 * tabs; release commits the tab under it. Quick taps are untouched (the pan
 * only activates after a long press).
 */
function TabRow({
  isFocused,
  hasUnreadDm,
  goTo
}: {
  isFocused: (name: TabName) => boolean;
  hasUnreadDm: boolean;
  goTo: (name: SlotName) => void;
}) {
  const [rowW, setRowW] = useState(0);
  // React mirror of the drag state — while scrubbing, the STATIC focused-tab
  // capsule hides so only the finger's capsule is lit.
  const [scrubbing, setScrubbing] = useState(false);
  const dragging = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragIndex = useSharedValue(0);

  const commit = (i: number) => {
    setScrubbing(false);
    goTo(TABS[Math.max(0, Math.min(TABS.length - 1, i))]);
  };
  const tick = () => haptic("selection");
  const beginScrub = () => {
    setScrubbing(true);
    haptic("selection");
  };
  const endScrub = () => setScrubbing(false);

  const half = CAPSULE_W / 2;
  const pan = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart((e) => {
      "worklet";
      const span = rowW > 0 ? rowW / TABS.length : 1;
      dragIndex.value = Math.max(0, Math.min(TABS.length - 1, Math.floor(e.x / span)));
      dragX.value = Math.max(ROW_PAD + half, Math.min(rowW - ROW_PAD - half, e.x));
      dragging.value = 1;
      runOnJS(beginScrub)();
    })
    .onUpdate((e) => {
      "worklet";
      const span = rowW > 0 ? rowW / TABS.length : 1;
      // The capsule follows the FINGER exactly; the index (haptic tick +
      // release target) tracks which slot it's over.
      dragX.value = Math.max(ROW_PAD + half, Math.min(rowW - ROW_PAD - half, e.x));
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
    transform: [{ translateX: dragX.value - half }, { scale: withSpring(dragging.value ? 1.04 : 0.92, springs.snappy) }]
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-evenly",
          height: ROW_H,
          paddingHorizontal: ROW_PAD
        }}
      >
        {/* Scrub capsule gliding under the finger. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: (ROW_H - CAPSULE_H) / 2,
              left: 0,
              width: CAPSULE_W,
              height: CAPSULE_H,
              borderRadius: radius.pill,
              backgroundColor: CAPSULE_SCRUB
            },
            scrubPillStyle
          ]}
        />
        {TABS.map((name) => (
          <TabSlot
            key={name}
            name={name}
            // While scrubbing, ONLY the finger capsule is highlighted.
            focused={!scrubbing && name !== "camera" && isFocused(name)}
            dot={name === "friends" && hasUnreadDm}
            onPress={() => goTo(name)}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

/**
 * Floating glass pill above the home indicator. Lightened for V2: shallower
 * shadow, no sheen gradient, 56pt row, one hairline border on the fallback.
 * Same five actions as before (camera pushes /camera).
 */
function GlassTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Activity dot on the DMs tab whenever any thread is unread or a request waits.
  const inbox = useInboxThreads();
  const messageRequests = useMessageRequests();
  const hasUnreadDm = (inbox.data ?? []).some((thread) => thread.unread) || (messageRequests.data ?? []).length > 0;

  const isFocused = (name: TabName) => state.routes[state.index]?.name === name;
  const bumpFeedReset = useTabActions((s) => s.bumpFeedReset);
  const goTo = (name: SlotName) => {
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

  const row = <TabRow isFocused={isFocused} hasUnreadDm={hasUnreadDm} goTo={goTo} />;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}
    >
      {/* Shadow lives on an unclipped wrapper; the material clips to the pill. */}
      <View
        style={{
          marginHorizontal: 24,
          marginBottom: insets.bottom > 0 ? insets.bottom : TAB_BAR_FLOAT_GAP,
          borderRadius: radius.pill,
          shadowColor: colors.black,
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10
        }}
      >
        {Glass && liquidGlassAvailable ? (
          /* iOS 26+: Apple's own Liquid Glass material. The native effect view
             must NOT own the row layout (its content view doesn't reliably
             forward flex styles); a plain inner View does the laying out. */
          <Glass.GlassView
            glassEffectStyle="regular"
            isInteractive
            style={{ borderRadius: radius.pill, overflow: "hidden" }}
          >
            {row}
          </Glass.GlassView>
        ) : (
          /* Pre-iOS-26 / Android fallback: system blur + one hairline. */
          <View
            style={{
              borderRadius: radius.pill,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: tokens.border.subtle
            }}
          >
            <BlurView
              intensity={90}
              tint={Platform.OS === "ios" ? "systemThinMaterialDark" : "dark"}
              style={{ backgroundColor: Platform.OS === "ios" ? colors.glassSoft : "rgba(10,10,10,0.7)" }}
            >
              {row}
            </BlurView>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <MaterialTabs
      tabBarPosition="bottom"
      initialRouteName="feed"
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        lazy: false,
        sceneStyle: { backgroundColor: colors.black }
      }}
    >
      <MaterialTabs.Screen name="feed" options={{ title: "Home" }} />
      <MaterialTabs.Screen name="friends" options={{ title: "Friends" }} />
      <MaterialTabs.Screen name="map" options={{ title: "Map" }} />
      <MaterialTabs.Screen name="profile" options={{ title: "Profile" }} />
    </MaterialTabs>
  );
}
