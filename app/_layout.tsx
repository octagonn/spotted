import "@/global.css";

import { ThemeProvider, type Theme } from "@react-navigation/native";
import { focusManager, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef } from "react";
import { AppState, View } from "react-native";

import { DismissKeyboard } from "@/components/ui/DismissKeyboard";
import { useProfileCache } from "@/hooks/useProfileCache";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { GrainOverlay } from "@/components/GrainOverlay";
import { NotificationBanner } from "@/components/NotificationBanner";
import { PushPrimingHost } from "@/components/PushPrimingHost";
import { FlashOverlay } from "@/components/ui/Flash";
import { SheetProvider } from "@/components/ui/Sheet";
import { ToastHost } from "@/components/ui/Toast";
import { useInAppBanners } from "@/hooks/useInAppBanners";
import { usePresenceSync } from "@/hooks/useGeofence";
import { useRealtime } from "@/hooks/useRealtime";
import { usePushTokenSync } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";
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
      queryClient.clear();
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
  const activeUserId = isSupabaseConfigured && status === "ready" ? userId : null;

  useResetOnAccountChange();
  useRealtime(activeUserId);
  useInAppBanners(activeUserId);
  usePushTokenSync(activeUserId);
  usePresenceSync();
  // Instant own-profile loads: snapshot profile queries to disk, seed at start.
  useProfileCache();
  return null;
}

/** Routes without an authenticated session; the signed-out guard leaves these alone. */
const AUTH_PATHS = new Set(["/", "/welcome", "/sign-in", "/email"]);

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
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1
          }
        }
      }),
    []
  );
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
  // silent — without this, post/story audio plays but produces no sound.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-black">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <AppServices />
          <SessionGuard />
          <SheetProvider>
            {/* App-wide: tapping dead space closes the keyboard. */}
            <DismissKeyboard>
            <View className="flex-1 bg-black">
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.black },
                  animation: "slide_from_right"
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                {/* Regular card (not a native modal): a native fullScreenModal renders
                    above the root-level sheet/toast hosts, hiding compose sheets. */}
                <Stack.Screen
                  name="camera"
                  options={{ animation: "slide_from_bottom", gestureEnabled: false }}
                />
                <Stack.Screen name="workout" options={{ animation: "slide_from_bottom" }} />
                <Stack.Screen name="workout/[id]" />
                <Stack.Screen name="post/[id]" options={{ presentation: "modal" }} />
                <Stack.Screen name="gym/[id]" options={{ presentation: "modal" }} />
                <Stack.Screen name="user/[username]" />
                <Stack.Screen name="chat/[id]" />
                <Stack.Screen name="inbox" />
                <Stack.Screen name="message-requests" />
                <Stack.Screen name="edit-profile" />
                <Stack.Screen name="people/[type]" />
                <Stack.Screen name="profile-posts/[postId]" />
                <Stack.Screen name="community/[id]/members" />
                {/* Regular card, not a native modal: native modals render above the
                    root-level toast host, so create errors/successes were invisible,
                    and the sheet offset left dead space above the wizard header. */}
                <Stack.Screen name="community-new" options={{ animation: "slide_from_bottom" }} />
                <Stack.Screen
                  name="story"
                  options={{ presentation: "fullScreenModal", animation: "fade" }}
                />
              </Stack>
              <ToastHost />
              <NotificationBanner />
              <PushPrimingHost />
              <GrainOverlay />
              <FlashOverlay />
              <StatusBar style="light" />
            </View>
            </DismissKeyboard>
          </SheetProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
