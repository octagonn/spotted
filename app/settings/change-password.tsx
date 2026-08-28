import { router } from "expo-router";
import { Check, Circle, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";

import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { getPasswordRequirements, passwordMeetsRequirements } from "@/lib/password";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

const RESEND_COOLDOWN_S = 30;

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${met ? "met" : "not met"}`}
      className="flex-row items-center gap-1.5"
    >
      {met ? <Check color={colors.white} size={14} /> : <Circle color={colors.fog} size={12} />}
      <Text variant="micro" className={met ? "text-white" : "text-fog"}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Change password (email accounts only — the Account screen hides the entry
 * for Apple-only sign-ins). Two steps, matching what the email actually
 * contains: a one-time CODE is sent on open, the user types it here, and once
 * it verifies they set the new password with confirmation. (The old copy
 * promised a reset "link" while the template sends a code — dead end.)
 */
export default function ChangePasswordScreen() {
  const email = useAuthStore((state) => state.session?.user.email ?? null);

  const [step, setStep] = useState<"code" | "password">("code");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const sentRef = useRef(false);

  const requirements = getPasswordRequirements(password);
  const valid =
    passwordMeetsRequirements(password) && confirmPassword.length > 0 && password === confirmPassword;

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    if (!email) return;
    setError(null);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email);
    if (sendError) {
      setError(
        /rate limit/i.test(sendError.message)
          ? "Too many codes requested — wait a minute and try again."
          : "Couldn't send the code. Check your connection and try again."
      );
      return;
    }
    setCooldown(RESEND_COOLDOWN_S);
  }, [email]);

  // Fire the code email once, as the screen opens.
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void sendCode();
  }, [sendCode]);

  async function verifyCode() {
    const token = code.trim();
    if (!email || token.length < 6 || verifying) return;
    setError(null);
    setVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
      if (verifyError) throw verifyError;
      setStep("password");
    } catch {
      setError("That code didn't match — double-check the email, or resend a fresh one.");
    } finally {
      setVerifying(false);
    }
  }

  async function save() {
    if (!valid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      showToast("Password updated");
      router.back();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't update password.";
      setError(
        /different from the old/i.test(message)
          ? "That's already your password — pick a new one."
          : message
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <Screen>
        <BackButton fallback="/settings/account" style={{ marginBottom: 18 }} />

        {step === "code" ? (
          <>
            <Text variant="display-sm">CHECK YOUR EMAIL.</Text>
            <Text variant="body" className="mt-4 text-silver">
              We sent a one-time code to {email ?? "your email"}. Enter it below to confirm it&apos;s you.
            </Text>

            <View className="mt-8 gap-3">
              <View className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <ShieldCheck color={colors.fog} size={18} />
                  <TextInput
                    value={code}
                    onChangeText={(value) => {
                      setCode(value.replace(/[^0-9]/g, ""));
                      setError(null);
                    }}
                    accessibilityLabel="One-time code"
                    placeholder="Code from the email"
                    placeholderTextColor={colors.fog}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={10}
                    returnKeyType="go"
                    onSubmitEditing={() => void verifyCode()}
                    className="flex-1 font-sans text-[16px] tracking-[4px] text-white"
                  />
                </View>
              </View>

              {error ? (
                <Text variant="caption" className="px-1 text-mist">
                  {error}
                </Text>
              ) : null}

              <Button
                className="mt-2"
                loading={verifying}
                disabled={code.trim().length < 6}
                onPress={() => void verifyCode()}
              >
                Verify code
              </Button>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resend code"
                disabled={cooldown > 0}
                onPress={() => void sendCode()}
                className="self-center py-2"
              >
                <Text variant="caption" className={cooldown > 0 ? "text-fog" : "text-white"}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text variant="display-sm">NEW PASSWORD.</Text>
            <Text variant="body" className="mt-4 text-silver">
              Use 8+ characters with at least one letter and one number.
            </Text>

            <View className="mt-8 gap-3">
              <View className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <LockKeyhole color={colors.fog} size={18} />
                  <TextInput
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setError(null);
                    }}
                    accessibilityLabel="New password"
                    placeholder="New password"
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
                    accessibilityLabel="Confirm password"
                    placeholder="Confirm password"
                    placeholderTextColor={colors.fog}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    secureTextEntry={!confirmPasswordVisible}
                    maxLength={72}
                    returnKeyType="go"
                    onSubmitEditing={save}
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
                <Requirement met={requirements.longEnough} label="8+ CHARACTERS" />
                <Requirement met={requirements.hasLetter} label="ONE LETTER" />
                <Requirement met={requirements.hasNumber} label="ONE NUMBER" />
              </View>

              {confirmPassword.length > 0 && password !== confirmPassword ? (
                <Text variant="caption" className="px-1 text-mist">
                  Passwords do not match.
                </Text>
              ) : null}

              {error ? (
                <Text variant="caption" className="px-1 text-mist">
                  {error}
                </Text>
              ) : null}

              <Button className="mt-2" loading={submitting} disabled={!valid} onPress={() => void save()}>
                Update password
              </Button>
            </View>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
