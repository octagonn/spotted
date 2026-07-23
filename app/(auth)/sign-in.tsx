import { router } from "expo-router";
import { Apple, Mail } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GrainOverlay } from "@/components/GrainOverlay";
import { LegalModal } from "@/components/LegalModal";
import { StaticAuroraBackground } from "@/components/StaticAuroraBackground";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { AppleSignInError, signInWithApple } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms");
  const setSession = useAuthStore((state) => state.setSession);

  async function handleApple() {
    setErrorText(null);
    if (!isSupabaseConfigured) {
      router.replace("/birthday");
      return;
    }
    setSubmitting(true);
    try {
      const result = await signInWithApple();
      await setSession(result.session);
      router.replace("/");
    } catch (error) {
      if (error instanceof AppleSignInError) {
        if (error.message === "Cancelled.") return;
        const lines = [error.message];
        if (error.hint) lines.push(error.hint);
        setErrorText(lines.join("\n\n"));
      } else {
        const message = error instanceof Error ? error.message : "Sign in failed.";
        Alert.alert("Couldn't sign in", message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-black">
      <StaticAuroraBackground />
      <GrainOverlay opacity={0.06} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          flexGrow: 1
        }}
      >
        <View className="flex-1 justify-end gap-6">
          <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
            <Text variant="micro" className="text-mist">
              STEP 1 OF 5
            </Text>
          </View>
          <Text variant="display-md">SIGN IN.</Text>
          <Text variant="italic">Pick how you want in.</Text>
          <View className="gap-3">
            <Button icon={<Mail color={colors.black} size={18} />} onPress={() => router.push("/email")}>
              Continue with email
            </Button>
            <Button
              icon={<Apple color={colors.white} size={19} />}
              variant="ghost"
              onPress={handleApple}
              loading={submitting}
            >
              Continue with Apple
            </Button>
          </View>
          {errorText ? (
            <View className="rounded-card border border-hairline-strong bg-glass-strong p-4">
              <Text variant="micro" className="text-white">
                SIGN-IN ERROR
              </Text>
              <Text variant="caption" className="mt-2 text-mist">
                {errorText}
              </Text>
            </View>
          ) : null}
          <View className="flex-row flex-wrap items-center">
            <Text variant="micro" className="text-fog">
              BY CONTINUING YOU AGREE TO{" "}
            </Text>
            <Pressable
              haptic={false}
              pressedClassName="opacity-60"
              onPress={() => {
                setLegalTab("terms");
                setLegalOpen(true);
              }}
            >
              <Text variant="micro" className="text-mist underline">
                TERMS
              </Text>
            </Pressable>
            <Text variant="micro" className="text-fog">
              {" "}
              &{" "}
            </Text>
            <Pressable
              haptic={false}
              pressedClassName="opacity-60"
              onPress={() => {
                setLegalTab("privacy");
                setLegalOpen(true);
              }}
            >
              <Text variant="micro" className="text-mist underline">
                PRIVACY
              </Text>
            </Pressable>
            <Text variant="micro" className="text-fog">
              .
            </Text>
          </View>
        </View>
      </ScrollView>

      <LegalModal visible={legalOpen} initialTab={legalTab} onClose={() => setLegalOpen(false)} />
    </View>
  );
}
