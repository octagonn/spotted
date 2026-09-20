import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { Check, Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GrainOverlay } from "@/components/GrainOverlay";
import { LegalModal } from "@/components/LegalModal";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { AppleSignInError, signInWithApple } from "@/lib/auth";
import { haptic } from "@/lib/haptics";
import { LEGAL_VERSION, recordLegalAcceptance } from "@/lib/legal";
import { logger } from "@/lib/logger";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

const LEGAL_REQUIRED_TEXT = "Tap the box below to agree to the Terms of Use and Privacy Policy first.";

/**
 * A second tap inside this window is a double-tap and is ignored. Anything
 * later means the Apple sheet is NOT on screen (it is modal — you cannot reach
 * our button while it is up), so the previous attempt is dead and the tap
 * starts a fresh one instead of being silently dropped.
 */
const APPLE_DOUBLE_TAP_MS = 1000;

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
  // In-flight Apple attempt (id + when it started) and whether one already won.
  const appleAttempt = useRef<{ id: number; startedAt: number } | null>(null);
  const appleDone = useRef(false);
  // Shake the legal row when a sign-in button is tapped before agreeing —
  // the error text alone was easy to miss over the video background.
  const legalShake = useSharedValue(0);
  const legalShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: legalShake.value }] }));

  // Sign in with Apple — shown only where the native sheet exists (iOS).
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  function requireLegal(): boolean {
    if (legalAccepted) return true;
    haptic("warning");
    legalShake.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
    setErrorText(LEGAL_REQUIRED_TEXT);
    return false;
  }

  function handleEmail() {
    setErrorText(null);
    if (!requireLegal()) return;
    fadeNavigate(() => router.push({ pathname: "/email", params: { legal: LEGAL_VERSION } }));
  }

  async function handleApple() {
    setErrorText(null);
    if (!requireLegal()) return;
    if (appleDone.current) return;

    const now = Date.now();
    const inflight = appleAttempt.current;
    if (inflight && now - inflight.startedAt < APPLE_DOUBLE_TAP_MS) return;
    const id = (inflight?.id ?? 0) + 1;
    appleAttempt.current = { id, startedAt: now };
    if (inflight) logger.warn("apple_sign_in_retry_over_stale_attempt");
    const isCurrent = () => appleAttempt.current?.id === id;

    haptic("selection");
    setAppleBusy(true);
    try {
      const result = await signInWithApple();
      // A superseded attempt that still comes back with a session wins too —
      // supabase-js has already persisted it, so use it rather than strand it.
      if (appleDone.current) return;
      if (!result.session) {
        throw new AppleSignInError(
          "Apple sign-in succeeded but no session was created.",
          "ERR_NO_SESSION",
          "Apple signed you in but the session didn't come back. Tap Continue with Apple once more."
        );
      }
      appleDone.current = true;
      // Best-effort — the session is live either way.
      await recordLegalAcceptance("apple").catch(() => {});
      await setSession(result.session);
      // Index routes onward: onboarding for new accounts, feed for existing.
      fadeNavigate(() => router.replace("/"));
    } catch (cause) {
      if (!isCurrent()) return; // a newer tap owns the UI now
      const code = cause instanceof AppleSignInError ? cause.code : undefined;
      if (code === "ERR_REQUEST_CANCELED") {
        return; // user closed the sheet after seeing it — not an error
      }
      logger.warn("apple_sign_in_failed", {
        code: code ?? "unknown",
        message: cause instanceof Error ? cause.message : String(cause)
      });
      const hint = cause instanceof AppleSignInError ? cause.hint : undefined;
      setErrorText(
        hint ??
          (cause instanceof Error && cause.message
            ? `${cause.message} You can also continue with email below.`
            : "Apple sign-in failed. Please try again, or continue with email below.")
      );
    } finally {
      if (isCurrent()) {
        appleAttempt.current = null;
        setAppleBusy(false);
      }
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
                native ASAuthorizationAppleIDButton is kept purely for its
                Apple-drawn look — the TAP is handled by our own Pressable
                wrapped around it (the native view gets pointerEvents="none").
                A tester's tap on the native control produced no sheet, no
                error and no Supabase request: whatever the cause, routing the
                press through JS guarantees handleApple always runs, gives the
                spec press feedback + haptic, and shows a spinner while the
                sheet is being requested so the button is never silent. */}
              {appleAvailable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Apple"
                  accessibilityState={{ busy: appleBusy }}
                  haptic="none"
                  pressScale={0.98}
                  onPress={() => void handleApple()}
                  style={{ opacity: appleBusy ? 0.6 : 1 }}
                >
                  <View pointerEvents="none">
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={26}
                      style={{ width: "100%", height: 52 }}
                      onPress={() => void handleApple()}
                    />
                  </View>
                  {appleBusy ? (
                    <View style={StyleSheet.absoluteFill} className="items-center justify-center" pointerEvents="none">
                      <ActivityIndicator color={colors.black} />
                    </View>
                  ) : null}
                </Pressable>
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
            <Animated.View className="flex-row items-start gap-3" style={legalShakeStyle}>
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
            </Animated.View>
          </View>
        </ScrollView>
      </Animated.View>

      <LegalModal visible={legalOpen} initialTab={legalTab} onClose={() => setLegalOpen(false)} />
    </View>
  );
}
