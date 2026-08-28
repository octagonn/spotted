import { Stack } from "expo-router";

// Every onboarding screen renders transparent over the ambient video
// background (mounted once in the ROOT layout) and sequences its own content
// fade via usePageFade — so the navigator switches instantly with no animation.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "none"
      }}
    />
  );
}
