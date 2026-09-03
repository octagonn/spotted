import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { Check, Mail } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GrainOverlay } from "@/components/GrainOverlay";
import { LegalModal } from "@/components/LegalModal";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { AppleSignInError, signInWithApple } from "@/lib/auth";
import { LEGAL_VERSION, recordLegalAcceptance } from "@/lib/legal";
import { logger } from "@/lib/logger";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { fadeStyle, fadeNavigate } = usePageFade();
  const setSession = useAuthStore((state) => state.setSession);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  // Sign in with Apple — shown only where the native sheet exists (iOS).
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  function handleEmail() {
    setErrorText(null);
    if (!legalAccepted) {
      setErrorText("Check the box to agree to the Terms of Use and Privacy Policy.");
      return;
    }
    fadeNavigate(() => router.push({ pathname: "/email", params: { legal: LEGAL_VERSION } }));
  }

  async function handleApple() {
    setErrorText(null);
    if (!legalAccepted) {
      setErrorText("Check the box to agree to the Terms of Use and Privacy Policy.");
      return;
    }
    if (appleBusy) return;
    setAppleBusy(true);
    try {
      const result = await signInWithApple();
      if (!result.session) {
        throw new AppleSignInError("Apple sign-in succeeded but no session was created. Try again.");
      }
      // Best-effort — the session is live either way.
      await recordLegalAcceptance("apple").catch(() => {});
      await setSession(result.session);
      // Index routes onward: onboarding for new accounts, feed for existing.
      fadeNavigate(() => router.replace("/"));
    } catch (cause) {
      if (cause instanceof AppleSignInError && cause.code === "ERR_REQUEST_CANCELED") {
        return; // user closed the sheet — not an error
      }
      logger.warn("apple_sign_in_failed", {
        message: cause instanceof Error ? cause.message : String(cause)
      });
      const hint = cause instanceof AppleSignInError ? cause.hint : undefined;
      setErrorText(hint ?? (cause instanceof Error ? cause.message : "Apple sign-in failed. Please try again."));
    } finally {
      setAppleBusy(false);
    }
  }

  return (
    // Transparent — the looping gym video lives in the (auth) layout below
    // this screen and keeps playing across welcome → sign-in.
    <View className="flex-1">
      <GrainOverlay opacity={0.06} />

      <Animated.View className="flex-1" style={fadeStyle}>
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
            <OnboardingHeader step={1} title="SIGN IN." body="Pick how you want in." />
            <View className="gap-3">
              {/* Apple first (HIG: at least as prominent as other options). The
                native button can't be visually disabled — the handler enforces
                the legal checkbox with the same error the email path shows. */}
              {appleAvailable ? (
                <View style={{ opacity: appleBusy ? 0.6 : 1 }}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={26}
                    style={{ width: "100%", height: 52 }}
                    onPress={() => void handleApple()}
                  />
                </View>
              ) : null}
              <Button
                icon={<Mail color={legalAccepted ? colors.black : colors.ash} size={icon.size.xs + 2} />}
                onPress={handleEmail}
                disabled={!legalAccepted}
              >
                Continue with email
              </Button>
            </View>
            {errorText ? (
              <View
                accessibilityLiveRegion="assertive"
                className="rounded-card border border-hairline-strong bg-glass-strong p-4"
              >
                <Text variant="micro" className="text-white">
                  SIGN-IN ERROR
                </Text>
                <Text variant="caption" className="mt-2 text-mist">
                  {errorText}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-start gap-3">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Agree to the Terms of Use and Privacy Policy"
                accessibilityState={{ checked: legalAccepted }}
                className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${
                  legalAccepted ? "border-white bg-white" : "border-hairline-strong bg-glass-soft"
                }`}
                onPress={() => {
                  setLegalAccepted((accepted) => !accepted);
                  setErrorText(null);
                }}
              >
                {legalAccepted ? <Check color={colors.black} size={16} strokeWidth={3} /> : null}
              </Pressable>
              <View className="flex-1 flex-row flex-wrap items-center">
                <Text variant="caption" className="text-fog">
                  I agree to the{" "}
                </Text>
                <Pressable
                  haptic={false}
                  accessibilityRole="link"
                  pressedClassName="opacity-60"
                  onPress={() => {
                    setLegalTab("terms");
                    setLegalOpen(true);
                  }}
                >
                  <Text variant="caption" className="text-white underline">
                    Terms of Use
                  </Text>
                </Pressable>
                <Text variant="caption" className="text-fog">
                  {" "}
                  and{" "}
                </Text>
                <Pressable
                  haptic={false}
                  accessibilityRole="link"
                  pressedClassName="opacity-60"
                  onPress={() => {
                    setLegalTab("privacy");
                    setLegalOpen(true);
                  }}
                >
                  <Text variant="caption" className="text-white underline">
                    Privacy Policy
                  </Text>
                </Pressable>
                <Text variant="caption" className="text-fog">
                  .
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      <LegalModal visible={legalOpen} initialTab={legalTab} onClose={() => setLegalOpen(false)} />
    </View>
  );
}
