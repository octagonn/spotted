import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Circle, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition
} from "react-native-reanimated";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
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

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

type Stage = "email" | "password" | "verify" | "create-password";

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {met ? <Check color={colors.white} size={14} /> : <Circle color={colors.fog} size={12} />}
      <Text variant="micro" className={met ? "text-white" : "text-fog"}>
        {label}
      </Text>
    </View>
  );
}

export default function EmailAuthScreen() {
  const { legal } = useLocalSearchParams<{ legal?: string }>();
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
  }

  async function handleBack() {
    if (stage === "email") {
      router.back();
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
    if (!isSupabaseConfigured) {
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
      router.replace("/");
    } catch {
      setError("Email or password is incorrect.");
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
      await recordLegalAcceptance("email");
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
      router.replace("/birthday");
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
      await sendEmailCode(cleanEmail, LEGAL_VERSION);
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
      <Screen>
        <Pressable className="self-start" disabled={submitting} onPress={handleBack}>
          <View className="flex-row items-center gap-2 rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1.5">
            <ArrowLeft color={colors.mist} size={14} />
            <Text variant="micro" className="text-mist">
              BACK
            </Text>
          </View>
        </Pressable>

        <Animated.View layout={LinearTransition.duration(300)} className="mt-12 gap-6">
          <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
            <Text variant="micro" className="text-mist">
              {isVerify ? "VERIFY" : isCreatePassword ? "ACCOUNT SETUP" : "STEP 1 OF 5"}
            </Text>
          </View>
          <Text variant={isCreatePassword ? "display-sm" : "display-md"}>
            {isVerify ? "CHECK EMAIL." : isCreatePassword ? "MAKE A PASSWORD." : "EMAIL."}
          </Text>
          <Text variant="body" className="text-silver">
            {isVerify
              ? `We sent a verification code to ${cleanEmail}.`
              : isCreatePassword
                ? "Use 8+ characters with at least one letter and one number."
              : stage === "password"
                ? "Enter your password to sign in."
                : "Enter your email to continue."}
          </Text>

          {!isVerify && !isCreatePassword ? (
            <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition.duration(300)}>
              <View className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <Mail color={colors.fog} size={18} />
                  <TextInput
                    value={email}
                    onChangeText={handleEmailChange}
                    placeholder="you@gym.com"
                    placeholderTextColor={colors.fog}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    inputMode="email"
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={continueWithEmail}
                    editable={!submitting}
                    className="flex-1 font-sans text-[16px] text-white"
                  />
                </View>
              </View>
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
              className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3"
            >
              <View className="flex-row items-center gap-3">
                <LockKeyhole color={colors.fog} size={18} />
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                  }}
                  placeholder="Password"
                  placeholderTextColor={colors.fog}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  secureTextEntry={!passwordVisible}
                  maxLength={72}
                  returnKeyType="go"
                  onSubmitEditing={signIn}
                  className="flex-1 font-sans text-[16px] text-white"
                />
                <Pressable
                  haptic={false}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? (
                    <EyeOff color={colors.fog} size={18} />
                  ) : (
                    <Eye color={colors.fog} size={18} />
                  )}
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {isCreatePassword ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.duration(300)}
              className="gap-3"
            >
              <View className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <LockKeyhole color={colors.fog} size={18} />
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setError(null);
                    }}
                    placeholder="Create password"
                    placeholderTextColor={colors.fog}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    secureTextEntry={!passwordVisible}
                    maxLength={72}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                    className="flex-1 font-sans text-[16px] text-white"
                  />
                  <Pressable
                    haptic={false}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? (
                      <EyeOff color={colors.fog} size={18} />
                    ) : (
                      <Eye color={colors.fog} size={18} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <LockKeyhole color={colors.fog} size={18} />
                  <TextInput
                    ref={confirmPasswordInputRef}
                    value={confirmPassword}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      setError(null);
                    }}
                    placeholder="Confirm password"
                    placeholderTextColor={colors.fog}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    secureTextEntry={!confirmPasswordVisible}
                    maxLength={72}
                    returnKeyType="go"
                    onSubmitEditing={createPassword}
                    className="flex-1 font-sans text-[16px] text-white"
                  />
                  <Pressable
                    haptic={false}
                    accessibilityRole="button"
                    accessibilityLabel={confirmPasswordVisible ? "Hide confirmed password" : "Show confirmed password"}
                    onPress={() => setConfirmPasswordVisible((visible) => !visible)}
                  >
                    {confirmPasswordVisible ? (
                      <EyeOff color={colors.fog} size={18} />
                    ) : (
                      <Eye color={colors.fog} size={18} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-x-4 gap-y-2 px-1 pt-1">
                <Requirement met={passwordRequirements.longEnough} label="8+ CHARACTERS" />
                <Requirement met={passwordRequirements.hasLetter} label="ONE LETTER" />
                <Requirement met={passwordRequirements.hasNumber} label="ONE NUMBER" />
              </View>

              {confirmPassword.length > 0 && password !== confirmPassword ? (
                <Text variant="caption" className="px-1 text-mist">
                  Passwords do not match.
                </Text>
              ) : null}
            </Animated.View>
          ) : null}

          {error ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
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
    </KeyboardAvoidingView>
  );
}
