import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade_from_bottom",
        // Same app-wide rule as the root stack: swipe back from anywhere.
        gestureEnabled: true,
        fullScreenGestureEnabled: true
      }}
    />
  );
}
