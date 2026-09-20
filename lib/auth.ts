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

/**
 * iOS reports ASAuthorizationError.canceled (1001) both when the user dismisses
 * the sheet AND when the system refuses to present one at all — no iCloud
 * account on the device, an Apple ID without two-factor authentication, a
 * child / managed Apple ID, or a Screen Time "account changes" restriction.
 * The sheet's own present animation takes ~0.5 s and a human needs time to
 * find Cancel, so a "cancel" that lands inside this window never showed a
 * sheet. Those must NOT be swallowed as a user cancel: to the person tapping,
 * the button simply did nothing.
 */
const APPLE_SHEET_NEVER_SHOWN_MS = 600;

/** Error code we raise for the instant-cancel case above. */
export const APPLE_SHEET_NOT_SHOWN = "ERR_SHEET_NOT_SHOWN";

const APPLE_SYSTEM_DECLINE_HINT =
  "Apple closed the sign-in sheet before it opened. On this iPhone, open Settings → your name and make sure you're signed in to iCloud with two-factor authentication turned on, then try again — or continue with email below.";

/** Native codes that mean the OS, not the user, stopped the request. */
const APPLE_SYSTEM_DECLINE_CODES = new Set([
  "ERR_REQUEST_UNKNOWN",
  "ERR_REQUEST_FAILED",
  "ERR_REQUEST_NOT_HANDLED",
  "ERR_REQUEST_NOT_INTERACTIVE",
  "ERR_INVALID_RESPONSE"
]);

/** Run the native Apple sheet and return a credential with an identity token. */
async function getAppleCredential(): Promise<AppleAuthentication.AppleAuthenticationCredential> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new AppleSignInError(
      "Sign in with Apple isn't available on this device.",
      "ERR_UNAVAILABLE",
      "Sign in with Apple isn't available on this device — continue with email below."
    );
  }
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  const startedAt = Date.now();
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL
      ]
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    const message = err instanceof Error ? err.message : "Apple sign-in failed.";
    if (code === "ERR_REQUEST_CANCELED") {
      if (Date.now() - startedAt < APPLE_SHEET_NEVER_SHOWN_MS) {
        throw new AppleSignInError(message, APPLE_SHEET_NOT_SHOWN, APPLE_SYSTEM_DECLINE_HINT);
      }
      throw new AppleSignInError("Cancelled.", code);
    }
    if (code && APPLE_SYSTEM_DECLINE_CODES.has(code)) {
      throw new AppleSignInError(message, code, APPLE_SYSTEM_DECLINE_HINT);
    }
    throw new AppleSignInError(message, code);
  }
  if (!credential.identityToken) {
    throw new AppleSignInError("Apple did not return an identity token.", "ERR_NO_IDENTITY_TOKEN");
  }
  return credential;
}

export async function signInWithApple() {
  const credential = await getAppleCredential();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken as string
  });
  if (error) {
    const message = error.message ?? "Sign in failed.";
    const lower = message.toLowerCase();
    let hint: string | undefined;
    if (lower.includes("audience")) {
      // Native flow: Supabase checks the token audience against the provider's
      // Client IDs list. "host.exp.Exponent" = you're testing in Expo Go.
      hint = `Apple rejected the app identity (${message}). In Supabase → Authentication → Providers → Apple, the Client IDs list must contain this build's bundle ID: com.octavio.spotted — or host.exp.Exponent when testing in Expo Go.`;
    } else if (lower.includes("provider is not enabled") || lower.includes("validation_failed")) {
      hint = `Apple sign-in isn't configured (${message}). Enable the Apple provider in Supabase → Authentication → Providers and add com.octavio.spotted to Client IDs.`;
    }
    throw new AppleSignInError(message, error.code ?? undefined, hint);
  }
  return data;
}

export type AppleLinkResult = "linked" | "already-linked" | "in-use" | "already-has-apple";

/**
 * Connect Sign in with Apple to the CURRENTLY signed-in account.
 *
 * The old approach signed in with the Apple token and hoped Supabase's
 * automatic linking matched on email. With Hide My Email it never matched —
 * it created a junk @privaterelay account and bounced the user into it — and
 * the browser fallback died at Apple ("Sign Up Not Completed") because the web
 * flow needs a Services ID, not this app's bundle ID.
 *
 * Now the native Apple sheet's identity token goes straight to the
 * link-apple-identity edge function, which verifies it against Apple's public
 * keys and attaches the identity server-side. Email is never part of the
 * decision, so Hide My Email works, and no stray account is ever created.
 */
export async function linkAppleToCurrentAccount(): Promise<AppleLinkResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new AppleSignInError("You need to be signed in to connect Apple.");
  }
  const credential = await getAppleCredential();
  const { data, error } = await supabase.functions.invoke<{ status?: string; error?: string }>(
    "link-apple-identity",
    { body: { identityToken: credential.identityToken } }
  );
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 409) {
      // Body carries which conflict it was.
      const body = await readInvokeError(error);
      if (body === "already_has_apple") return "already-has-apple";
      return "in-use";
    }
    throw new AppleSignInError("Couldn't connect Apple sign-in. Try again in a moment.");
  }
  if (data?.status === "already_linked") return "already-linked";
  if (data?.status === "linked") return "linked";
  throw new AppleSignInError("Couldn't connect Apple sign-in. Try again in a moment.");
}

/** Pull the `error` field out of a non-2xx functions.invoke response. */
async function readInvokeError(error: unknown): Promise<string | null> {
  try {
    const response = (error as { context?: Response }).context;
    if (!response || typeof response.json !== "function") return null;
    const body = (await response.json()) as { error?: string };
    return body.error ?? null;
  } catch {
    return null;
  }
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
