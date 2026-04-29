import "@/global.css";

import { ThemeProvider, type Theme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Boldonse_400Regular } from "@expo-google-fonts/boldonse";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from "@expo-google-fonts/geist";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { GrainOverlay } from "@/components/GrainOverlay";
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
    Boldonse_400Regular,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold
  });

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-black">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <View className="flex-1 bg-black">
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.black },
                animation: "fade_from_bottom"
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="post/[id]" options={{ presentation: "modal" }} />
              <Stack.Screen name="gym/[id]" options={{ presentation: "modal" }} />
              <Stack.Screen name="user/[username]" />
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="streak" options={{ presentation: "modal" }} />
              <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <GrainOverlay />
            <StatusBar style="light" />
          </View>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
