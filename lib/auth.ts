import * as AppleAuthentication from "expo-apple-authentication";

import { PASSWORD_SETUP_METADATA_KEY } from "@/lib/authRouting";
import { supabase } from "@/lib/supabase";

export class AppleSignInError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "AppleSignInError";
  }
}

export async function signInWithApple() {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new AppleSignInError("Sign in with Apple isn't available on this device.");
  }
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL
      ]
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_REQUEST_CANCELED") {
      throw new AppleSignInError("Cancelled.", code);
    }
    throw new AppleSignInError(
      err instanceof Error ? err.message : "Apple sign-in failed.",
      code
    );
  }
  if (!credential.identityToken) {
    throw new AppleSignInError("Apple did not return an identity token.");
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken
  });
  if (error) {
    const message = error.message ?? "Sign in failed.";
    let hint: string | undefined;
    if (
      message.toLowerCase().includes("provider is not enabled") ||
      message.toLowerCase().includes("apple sign-in") ||
      message.toLowerCase().includes("validation_failed") ||
      message.toLowerCase().includes("audience")
    ) {
      hint =
        "Enable Apple in Supabase: Authentication → Providers → Apple. Set Services ID = com.octavio.spotted (or your Services ID), Team ID, Key ID, and the .p8 secret. Save, then retry.";
    }
    throw new AppleSignInError(message, error.code ?? undefined, hint);
  }
  return data;
}

export type EmailAuthMethod = "password" | "otp";

export async function getEmailAuthMethod(email: string): Promise<EmailAuthMethod> {
  const { data, error } = await supabase.functions.invoke<{ method?: EmailAuthMethod }>(
    "email-auth-status",
    { body: { email } }
  );
  if (error) {
    throw new Error("Couldn't check that email. Please try again.");
  }
  return data?.method === "password" ? "password" : "otp";
}

export async function sendEmailCode(email: string, legalVersion?: string) {
  const metadata: Record<string, string | boolean> = {
    [PASSWORD_SETUP_METADATA_KEY]: true
  };
  if (legalVersion) {
    metadata.legal_version = legalVersion;
    metadata.legal_accepted_at = new Date().toISOString();
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: metadata
    }
  });
  if (error) {
    throw error;
  }
}

export async function signInWithEmailPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data;
}

export async function verifyEmailCode(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    throw error;
  }
  return data;
}

export async function setEmailPassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({
    password,
    data: { [PASSWORD_SETUP_METADATA_KEY]: false }
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function requireEmailPasswordSetup() {
  const { data, error } = await supabase.auth.updateUser({
    data: { [PASSWORD_SETUP_METADATA_KEY]: true }
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function signInWithPhone(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    throw error;
  }
}

export async function verifyPhone(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) {
    throw error;
  }
  return data;
}
