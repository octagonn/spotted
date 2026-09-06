import "@/global.css";

import { ThemeProvider, type Theme } from "@react-navigation/native";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import { Boldonse_400Regular } from "@expo-google-fonts/boldonse";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold
} from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { setAudioModeAsync } from "expo-audio";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";

import { AppDialogHost } from "@/components/ui/AppDialog";
import { DismissKeyboard } from "@/components/ui/DismissKeyboard";
import { useActivityHeartbeat } from "@/lib/analytics";
import { persistOptions, queryClient, wipeQueryCaches } from "@/lib/queryClient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AmbientVideoBackground } from "@/components/AmbientVideoBackground";
import { ZoomPreviewHost } from "@/components/post/ZoomPreviewHost";
import { GrainOverlay } from "@/components/GrainOverlay";
import { AnalyticsConsentHost } from "@/components/AnalyticsConsentHost";
import { PolicyUpdateNotice } from "@/components/PolicyUpdateNotice";
import { JoinGymCommunityPrompt } from "@/components/communities/JoinGymCommunityPrompt";
import { PushPrimingHost } from "@/components/PushPrimingHost";
import { FlashOverlay } from "@/components/ui/Flash";
import { PostCelebration } from "@/components/ui/PostCelebration";
import { SheetProvider } from "@/components/ui/Sheet";
import { ToastHost } from "@/components/ui/Toast";
import { usePresenceSync } from "@/hooks/useGeofence";
import { useInAppBanners } from "@/hooks/useInAppBanners";
import { NotificationBanner } from "@/components/NotificationBanner";
import { TrophyEarnHost } from "@/components/trophies/TrophyEarnHost";
import { useRealtime } from "@/hooks/useRealtime";
import { useNotificationObserver, usePushTokenSync } from "@/lib/notifications";
import { useRestoreOnLogin } from "@/hooks/useRestoreOnLogin";
import { usePendingPostUploader } from "@/hooks/usePendingPostUploader";
import { useTimezoneSync } from "@/hooks/useTimezoneSync";
import { clearPendingPosts } from "@/lib/offlineQueue";
import { ConfigBlocker } from "@/components/ConfigBlocker";
import { useOtaSelfHeal } from "@/hooks/useOtaSelfHeal";
import { clearSignedUrlCache, isBrokenRelease, isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useRelationshipsStore } from "@/stores/relationships";
import { useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: colors.white,
    background: colors.black,
    card: colors.black,
    text: colors.bone,
    border: colors.iron,
    notification: colors.white
  },
  fonts: {
    regular: { fontFamily: "Geist_400Regular", fontWeight: "400" },
    medium: { fontFamily: "Geist_500Medium", fontWeight: "500" },
    bold: { fontFamily: "Geist_600SemiBold", fontWeight: "600" },
    heavy: { fontFamily: "Boldonse_400Regular", fontWeight: "400" }
  }
};

/**
 * Wipes all per-account client state (React Query cache + session zustand
 * stores) whenever the signed-in user changes. Without this, an account switch
 * within one app session leaks the previous user's cached data — the reported
 * bug where a fresh account saw the prior user's friends. Query keys aren't all
 * user-scoped, so clearing the whole cache is the reliable fix. The initial
 * null→user hydrate is skipped so a legit session keeps its posted-today flag.
 */
function useResetOnAccountChange() {
  const userId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevUserId.current;
    if (prev !== null && prev !== userId) {
      // Also wipes the PERSISTED caches — an account switch must not restore
      // the previous user's data (or signed media URLs) from disk next launch.
      void wipeQueryCaches();
      void clearSignedUrlCache();
      // The old account's queued offline posts must not upload as the new one.
      void clearPendingPosts();
      useRelationshipsStore.getState().reset();
      useUiStore.getState().resetForAccount();
    }
    prevUserId.current = userId;
  }, [userId, queryClient]);
}

/** Session-scoped side effects: realtime invalidation, push token sync, presence sync. */
function AppServices() {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.userId);
  const pathname = usePathname();
  const activeUserId = isSupabaseConfigured && status === "ready" ? userId : null;

  useResetOnAccountChange();
  // Backend-only activity ledger (DAU / retention for every user, no consent
  // needed — same class of data as last login).
  useActivityHeartbeat(activeUserId);
  useRealtime(activeUserId);
  // Foreground DM/taunt banners — instant in-app notification of new messages.
  useInAppBanners(activeUserId);
  usePushTokenSync(activeUserId);
  useNotificationObserver(activeUserId);
  useRestoreOnLogin(activeUserId);
  usePresenceSync();
  // Offline post queue: uploads gym-dead-zone posts once a connection returns.
  usePendingPostUploader(activeUserId);
  // Server-side daily windows (taunt limits, quiet hours) key off
  // profiles.timezone — keep it matched to the device.
  useTimezoneSync(activeUserId);
  // (useProfileCache retired — the persisted query cache in lib/queryClient
  // now restores EVERY query at launch, not just the own-profile snapshot.)
  return (
    <>
      <AnalyticsConsentHost userId={activeUserId} pathname={pathname} />
      <PolicyUpdateNotice userId={activeUserId} />
      {/* Opt-in prompt after a check-in at a gym with a community (spec). */}
      <JoinGymCommunityPrompt userId={activeUserId} />
    </>
  );
}

/** Routes without an authenticated session; the signed-out guard leaves these alone. */
const AUTH_PATHS = new Set(["/", "/welcome", "/sign-in", "/email"]);

/**
 * The looping gym video behind the entire auth + onboarding flow. Mounted once
 * HERE (above both route groups) so it plays continuously across every screen
 * and even the (auth) → (onboarding) boundary — screens in those groups render
 * transparent and sequence their own content fades via usePageFade.
 */
function AmbientFlowBackground() {
  const segments = useSegments();
  const inFlow = segments[0] === "(auth)" || segments[0] === "(onboarding)";
  if (!inFlow) return null;
  return <AmbientVideoBackground />;
}

/**
 * Server-truth session enforcement. Revalidates the cached session against the
 * auth server whenever the app returns to the foreground (a user deleted in
 * Supabase still holds a locally valid token), and routes any session that
 * becomes signed-out — revoked, deleted, or refresh-failed — back to Welcome.
 */
function SessionGuard() {
  const status = useAuthStore((state) => state.status);
  const revalidate = useAuthStore((state) => state.revalidate);
  const hydrate = useAuthStore((state) => state.hydrate);
  const pathname = usePathname();
  const router = useRouter();

  // Hydrate here, not just on the index route: deep links (web URLs, future
  // notification taps) never mount index, leaving the auth store empty and
  // silently disabling every query that needs the user id.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      // Drives react-query's refetchOnWindowFocus: queries marked "always"
      // (e.g. the feed) refetch every time the app returns to the foreground.
      focusManager.setFocused(nextState === "active");
      if (nextState === "active") {
        void revalidate();
      }
    });
    return () => subscription.remove();
  }, [revalidate]);

  useEffect(() => {
    if (status === "signed-out" && !AUTH_PATHS.has(pathname)) {
      router.replace("/welcome");
    }
  }, [status, pathname, router]);

  return null;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Anton_400Regular,
    Boldonse_400Regular,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium
  });

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Music previews must be audible even with the iPhone ring/silent switch on
  // silent — without this, post audio plays but produces no sound.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Pull EAS Updates on every foreground (not only cold start) so a device
  // holding a bad bundle heals itself. Mounted above the broken-release gate
  // on purpose: it is the way OUT of that screen.
  useOtaSelfHeal();

  if (!loaded) {
    return null;
  }

  // A release bundle with no backend config never mounts the app. The
  // 2026-09-02 OTA shipped one and every device rendered the DEV fixture
  // data (mock "Octavio" signed in). Nothing below this line can run now.
  if (isBrokenRelease) {
    return (
      <GestureHandlerRootView className="flex-1 bg-black">
        <ConfigBlocker />
        <StatusBar style="light" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-black">
      {/* Persisted cache: screens paint instantly from the last session while a
          background refetch runs. Restore is async (AsyncStorage) — queries are
          paused until hydration completes. */}
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ThemeProvider value={navigationTheme}>
          <AppServices />
          <SessionGuard />
          <SheetProvider>
            {/* App-wide: tapping dead space closes the keyboard. */}
            <DismissKeyboard>
            <View className="flex-1 bg-black">
              <AmbientFlowBackground />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.black },
                  animation: "slide_from_right",
                  // Pushed screens dismiss with a finger-tracking swipe from
                  // ANYWHERE on the page (IG/Snap), not only the left edge.
                  // Screens that slide up opt into a vertical gesture instead.
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true
                }}
              >
                <Stack.Screen name="index" />
                {/* Transparent + instant: the ambient video shows through and
                    keeps playing across the auth ↔ onboarding boundary while
                    each screen sequences its own fade. */}
                <Stack.Screen
                  name="(auth)"
                  options={{ contentStyle: { backgroundColor: "transparent" }, animation: "none" }}
                />
                <Stack.Screen
                  name="(onboarding)"
                  options={{ contentStyle: { backgroundColor: "transparent" }, animation: "none" }}
                />
                <Stack.Screen name="(tabs)" />
                {/* Regular card (not a native modal): a native fullScreenModal renders
                    above the root-level sheet/toast hosts, hiding compose sheets. */}
                <Stack.Screen
                  name="camera"
                  // Fast open: the camera should feel instant, not slide up on
                  // the stack's leisurely default (~400ms).
                  options={{ animation: "slide_from_bottom", animationDuration: 160, gestureEnabled: false }}
                />
                {/* Slides up like a modal, so it dismisses like one: swipe down
                    anywhere (matches the settings/menu swipe behavior). */}
                <Stack.Screen
                  name="workout"
                  options={{
                    animation: "slide_from_bottom",
                    // No dismiss gesture: the full-screen vertical swipe fought
                    // the exercise list's scroll (scroll "stuck") and let a
                    // flick-down abandon a live workout. Back arrow only.
                    gestureEnabled: false
                  }}
                />
                <Stack.Screen name="workout/[id]" />
                {/* Regular card, not a native modal: native modals render above
                    the root-level sheet host, so the report sheet opened from a
                    post's ⋯ menu was hidden behind the post itself. */}
                <Stack.Screen
                  name="post/[id]"
                  options={{
                    animation: "slide_from_bottom",
                    gestureEnabled: true,
                    gestureDirection: "vertical",
                    animationMatchesGesture: true
                  }}
                />
                <Stack.Screen name="gym/[id]" options={{ presentation: "modal" }} />
                <Stack.Screen name="chat/[id]" />
                <Stack.Screen name="chat-details/[id]" />
                <Stack.Screen
                  name="drafts"
                  options={{ animation: "slide_from_bottom", gestureDirection: "vertical", animationMatchesGesture: true }}
                />
                <Stack.Screen name="inbox" />
                <Stack.Screen name="message-requests" />
                <Stack.Screen name="edit-profile" />
                <Stack.Screen name="people/[type]" />
                {/* Long scrolling grid: the anywhere-on-page dismiss swipe kept
                    firing on diagonal scroll thumbs, closing the trophy case.
                    Standard left-edge swipe-back only. */}
                <Stack.Screen name="profile-section/[section]" options={{ fullScreenGestureEnabled: false }} />
                {/* Same for the profile's post feed: "2-3 scrolls and it swipes
                    me out" (tester, 2026-09-02). Left-edge swipe or back arrow. */}
                <Stack.Screen name="profile-posts/[postId]" options={{ fullScreenGestureEnabled: false }} />
                <Stack.Screen name="user/[username]" options={{ fullScreenGestureEnabled: false }} />
                <Stack.Screen name="community/[id]/members" />
                {/* Regular card, not a native modal: native modals render above the
                    root-level toast host, so create errors/successes were invisible,
                    and the sheet offset left dead space above the wizard header. */}
                <Stack.Screen
                  name="community-new"
                  options={{ animation: "slide_from_bottom", gestureDirection: "vertical", animationMatchesGesture: true }}
                />
              </Stack>
              {/* IG-style pinch-zoom preview: rendered above navigation so a
                  zoomed post photo covers the whole screen. */}
              <ZoomPreviewHost />
              {/* Spotted-themed dialogs (replaces the native Alert app-wide). */}
              <AppDialogHost />
              <ToastHost />
              <NotificationBanner />
              <TrophyEarnHost />
              <PushPrimingHost />
              <GrainOverlay />
              <FlashOverlay />
              <PostCelebration />
              <StatusBar style="light" />
            </View>
            </DismissKeyboard>
          </SheetProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
