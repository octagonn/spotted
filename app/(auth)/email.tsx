import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { AuthField, PasswordField, PasswordRequirements } from "@/components/auth/AuthField";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import {
  getEmailAuthMethod,
  requireEmailPasswordSetup,
  sendEmailCode,
  setEmailPassword,
  signInWithEmailPassword,
  verifyEmailCode
} from "@/lib/auth";
import { userNeedsPasswordSetup } from "@/lib/authRouting";
import { LEGAL_VERSION, recordLegalAcceptance } from "@/lib/legal";
import { getPasswordRequirements, passwordMeetsRequirements } from "@/lib/password";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

type Stage = "email" | "password" | "verify" | "create-password";

export default function EmailAuthScreen() {
  const { legal } = useLocalSearchParams<{ legal?: string }>();
  const { fadeStyle, fadeNavigate } = usePageFade();
  const session = useAuthStore((state) => state.session);
  const needsPasswordSetup = userNeedsPasswordSetup(session?.user);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [stage, setStage] = useState<Stage>(needsPasswordSetup ? "create-password" : "email");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendRemaining, setResendRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // True while the verify/create-password stages are a password RESET for an
  // existing account (entered via "Forgot password?") rather than a sign-up.
  const [isReset, setIsReset] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const setSession = useAuthStore((state) => state.setSession);
  const signOut = useAuthStore((state) => state.signOut);

  const cleanEmail = email.trim().toLowerCase();
  const emailValid = emailRegex.test(cleanEmail);
  const passwordValid = password.length > 0;
  const passwordRequirements = getPasswordRequirements(password);
  const newPasswordValid =
    passwordMeetsRequirements(password) && confirmPassword.length > 0 && password === confirmPassword;
  const codeValid = /^\d{8}$/.test(code);

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const timer = setTimeout(() => setResendRemaining((remaining) => remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendRemaining]);

  function resetToEmail() {
    setStage("email");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
    setError(null);
    setIsReset(false);
  }

  async function handleBack() {
    if (stage === "email") {
      fadeNavigate(() => router.back());
      return;
    }
    if (stage === "create-password") {
      setSubmitting(true);
      try {
        await signOut();
      } finally {
        setSubmitting(false);
      }
    }
    resetToEmail();
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setError(null);
    if (stage === "password") {
      setStage("email");
      setPassword("");
      setPasswordVisible(false);
    }
  }

  async function continueWithEmail() {
    if (!emailValid) return;
    setError(null);
    // Demo-mode shortcut into onboarding is DEV-ONLY (see stores/auth hydrate):
    // an unconfigured release bundle must stay on the auth screens.
    if (!isSupabaseConfigured && __DEV__) {
      router.replace("/birthday");
      return;
    }
    setSubmitting(true);
    try {
      const method = await getEmailAuthMethod(cleanEmail);
      if (method === "password") {
        setStage("password");
        setTimeout(() => passwordInputRef.current?.focus(), 320);
        return;
      }
      if (legal !== LEGAL_VERSION) {
        setError("Go back and agree to the Terms of Use and Privacy Policy before creating an account.");
        return;
      }
      await sendEmailCode(cleanEmail, LEGAL_VERSION);
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      setStage("verify");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't continue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signIn() {
    if (!emailValid || !passwordValid) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signInWithEmailPassword(cleanEmail, password);
      await setSession(result.session);
      fadeNavigate(() => router.replace("/"));
    } catch {
      setError("Email or password is incorrect.");
    } finally {
      setSubmitting(false);
    }
  }

  // Only reachable from the password stage, i.e. accounts that actually sign
  // in with a password — Apple-only users never see it. Reuses the sign-up
  // plumbing: emailed code → verify → set a new password.
  async function forgotPassword() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await sendEmailCode(cleanEmail);
      setIsReset(true);
      setPassword("");
      setPasswordVisible(false);
      setResendRemaining(RESEND_COOLDOWN_SECONDS);
      setStage("verify");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send a reset code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    if (!codeValid) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyEmailCode(cleanEmail, code);
      if (!result.session) {
        throw new Error("The code was accepted, but no session was created. Please request a new code.");
      }
      if (!isReset) {
        await recordLegalAcceptance("email");
      }
      await requireEmailPasswordSetup();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error("The code was accepted, but no session was created. Please request a new code.");
      }
      await setSession(data.session);
      setPassword("");
      setConfirmPassword("");
      setPasswordVisible(false);
      setConfirmPasswordVisible(false);
      setStage("create-password");
      setTimeout(() => passwordInputRef.current?.focus(), 320);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't verify code.";
      const invalid = /invalid|expired/i.test(message);
      setError(invalid ? "That code is invalid or expired. Request a new code and try again." : message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createPassword() {
    if (!newPasswordValid) return;
    setError(null);
    setSubmitting(true);
    try {
      await setEmailPassword(password);
      const { data } = await supabase.auth.getSession();
      await setSession(data.session);
      // Sign-ups go STRAIGHT to /birthday (staying inside the video-backed
      // flow — detouring through the root index unmounts the background and
      // shows a black loading flash). Password resets leave the flow, so the
      // index can route them into the app.
      fadeNavigate(() => router.replace(isReset ? "/" : "/birthday"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't create password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (resendRemaining > 0 || resending) return;
    setError(null);
    setResendRemaining(RESEND_COOLDOWN_SECONDS);
    setResending(true);
    try {
      await sendEmailCode(cleanEmail, isReset ? undefined : LEGAL_VERSION);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't resend code.");
    } finally {
      setResending(false);
    }
  }

  const isVerify = stage === "verify";
  const isCreatePassword = stage === "create-password";
  const actionLabel =
    stage === "password"
      ? "Sign in"
      : stage === "verify"
        ? "Verify"
        : stage === "create-password"
          ? "Create password"
          : "Continue";
  const actionDisabled =
    stage === "password"
      ? !passwordValid
      : stage === "verify"
        ? !codeValid
        : stage === "create-password"
          ? !newPasswordValid
          : !emailValid;
  const action =
    stage === "password"
      ? signIn
      : stage === "verify"
        ? verifyCode
        : stage === "create-password"
          ? createPassword
          : continueWithEmail;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, fadeStyle]}>
        <Screen transparent>
          <Pressable className="self-start" disabled={submitting} onPress={handleBack}>
            <View className="flex-row items-center gap-2 rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1.5">
              <ArrowLeft color={colors.mist} size={icon.size.xs - 2} />
              <Text variant="micro" className="text-mist">
                BACK
              </Text>
            </View>
          </Pressable>

          <Animated.View layout={LinearTransition.duration(300)} className="mt-12 gap-6">
            <OnboardingHeader
              step={1}
              label={
                isVerify ? "VERIFY" : isCreatePassword ? (isReset ? "RESET PASSWORD" : "ACCOUNT SETUP") : undefined
              }
              compact={isCreatePassword}
              title={
                isVerify
                  ? "CHECK EMAIL."
                  : isCreatePassword
                    ? isReset
                      ? "NEW PASSWORD."
                      : "MAKE A PASSWORD."
                    : "EMAIL."
              }
              body={
                isVerify
                  ? `We sent a verification code to ${cleanEmail}.`
                  : isCreatePassword
                    ? "Use 8+ characters with at least one letter and one number."
                    : stage === "password"
                      ? "Enter your password to sign in."
                      : "Enter your email to continue."
              }
            />

            {!isVerify && !isCreatePassword ? (
              <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition.duration(300)}>
                <AuthField
                  icon={<Mail color={colors.fog} size={icon.size.xs + 2} />}
                  value={email}
                  onChangeText={handleEmailChange}
                  accessibilityLabel="Email"
                  placeholder="you@gym.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  inputMode="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={continueWithEmail}
                  editable={!submitting}
                />
              </Animated.View>
            ) : null}

            {isVerify ? (
              <Animated.View
                entering={FadeInDown.duration(280)}
                exiting={FadeOut.duration(160)}
                className="rounded-card border border-hairline-strong bg-glass-soft px-4 py-3"
              >
                <TextInput
                  value={code}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, "").slice(0, 8));
                    setError(null);
                  }}
                  accessibilityLabel="Verification code"
                  placeholder="••••••••"
                  placeholderTextColor={colors.fog}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={8}
                  autoFocus
                  className="font-display text-center text-[36px] tracking-[8px] text-white"
                />
              </Animated.View>
            ) : null}

            {stage === "password" ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.duration(300)}
              >
                <PasswordField
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                  }}
                  accessibilityLabel="Password"
                  placeholder="Password"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={signIn}
                  visible={passwordVisible}
                  onToggleVisible={() => setPasswordVisible((visible) => !visible)}
                />
              </Animated.View>
            ) : null}

            {stage === "password" ? (
              <Pressable
                haptic={false}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
                disabled={submitting}
                onPress={() => void forgotPassword()}
                className="self-end"
              >
                <Text variant="caption" className="text-mist underline">
                  Forgot password?
                </Text>
              </Pressable>
            ) : null}

            {isCreatePassword ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.duration(300)}
                className="gap-3"
              >
                <PasswordField
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                  }}
                  accessibilityLabel="Create password"
                  placeholder="Create password"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  visible={passwordVisible}
                  onToggleVisible={() => setPasswordVisible((visible) => !visible)}
                />

                <PasswordField
                  ref={confirmPasswordInputRef}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setError(null);
                  }}
                  accessibilityLabel="Confirm password"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={createPassword}
                  visible={confirmPasswordVisible}
                  onToggleVisible={() => setConfirmPasswordVisible((visible) => !visible)}
                  what="confirmed password"
                />

                <PasswordRequirements requirements={passwordRequirements} />

                {confirmPassword.length > 0 && password !== confirmPassword ? (
                  <Text variant="caption" className="px-1 text-mist">
                    Passwords do not match.
                  </Text>
                ) : null}
              </Animated.View>
            ) : null}

            {error ? (
              <Animated.View
                accessibilityLiveRegion="assertive"
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
              >
                <Text variant="caption" className="text-mist">
                  {error}
                </Text>
              </Animated.View>
            ) : null}

            <Animated.View layout={LinearTransition.duration(300)}>
              <Button onPress={action} loading={submitting} disabled={actionDisabled} animateLabel>
                {actionLabel}
              </Button>
            </Animated.View>

            {isVerify ? (
              <Animated.View entering={FadeInDown.delay(80).duration(240)}>
                <Pressable
                  disabled={resendRemaining > 0 || resending}
                  onPress={resendCode}
                  accessibilityRole="button"
                  accessibilityLabel={resendRemaining > 0 ? `Resend code in ${resendRemaining} seconds` : "Resend code"}
                >
                  <View
                    className="h-12 items-center justify-center rounded-card border border-hairline-strong bg-glass-soft"
                    style={{ opacity: resendRemaining > 0 ? 0.55 : 1 }}
                  >
                    {resending ? (
                      <ActivityIndicator color={colors.mist} size="small" />
                    ) : (
                      <Text variant="micro" className="text-mist">
                        {resendRemaining > 0 ? `RESEND CODE IN ${resendRemaining}S` : "RESEND CODE"}
                      </Text>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>
        </Screen>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
