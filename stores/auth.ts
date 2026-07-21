import type { Session } from "@supabase/supabase-js";
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { create } from "zustand";

import { userNeedsPasswordSetup } from "@/lib/authRouting";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AuthStatus =
  | "loading"
  | "signed-out"
  | "needs-password"
  | "needs-profile"
  | "needs-onboarding"
  | "ready";

export type OnboardingStage = "permissions" | "home-gym" | "schedule";

const ONBOARDING_STAGES: OnboardingStage[] = ["permissions", "home-gym", "schedule"];

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  userId: string | null;
  profileId: string | null;
  /** Where an unfinished onboarding should resume (status "needs-onboarding"). */
  onboardingStage: OnboardingStage | null;
  /** True when status is "needs-profile" and the user hasn't given a birth date yet. */
  needsBirthdate: boolean;
  hydrate: () => Promise<void>;
  revalidate: () => Promise<void>;
  setSession: (session: Session | null) => Promise<void>;
  markProfileCreated: (profileId: string) => void;
  setOnboardingStage: (stage: OnboardingStage | "complete") => void;
  signOut: () => Promise<void>;
};

/**
 * Ask the auth server whether the locally cached session still belongs to a real
 * user. `getSession()` alone trusts device storage, so a user deleted in Supabase
 * would stay "signed in" until their access token expired.
 *
 * Returns "invalid" only on definitive auth rejections (user deleted, token
 * revoked, session gone). Network failures return "unknown" so an offline
 * relaunch never logs the user out.
 */
async function checkSessionAgainstServer(): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const { error } = await supabase.auth.getUser();
    if (!error) {
      return "valid";
    }
    if (isAuthSessionMissingError(error)) {
      return "invalid";
    }
    if (isAuthApiError(error)) {
      if ([401, 403, 404].includes(error.status)) {
        return "invalid";
      }
      const code = error.code ?? "";
      if (["user_not_found", "session_not_found", "refresh_token_not_found", "bad_jwt"].includes(code)) {
        return "invalid";
      }
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function dropInvalidSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Local storage cleanup is best-effort; state below is the source of truth.
  }
}

type ResolvedAuth = {
  status: AuthStatus;
  userId: string | null;
  profileId: string | null;
  onboardingStage: OnboardingStage | null;
  needsBirthdate: boolean;
};

function isOnboardingStage(value: unknown): value is OnboardingStage {
  return typeof value === "string" && (ONBOARDING_STAGES as string[]).includes(value);
}

async function resolveStatusForSession(session: Session | null): Promise<ResolvedAuth> {
  if (!session) {
    return { status: "signed-out", userId: null, profileId: null, onboardingStage: null, needsBirthdate: false };
  }
  const userId = session.user.id;
  if (userNeedsPasswordSetup(session.user)) {
    return { status: "needs-password", userId, profileId: null, onboardingStage: null, needsBirthdate: false };
  }
  if (!isSupabaseConfigured) {
    return { status: "ready", userId, profileId: userId, onboardingStage: null, needsBirthdate: false };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, onboarding_stage")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    const needsBirthdate = typeof session.user.user_metadata?.birth_date !== "string";
    return { status: "needs-profile", userId, profileId: null, onboardingStage: null, needsBirthdate };
  }
  if (isOnboardingStage(data.onboarding_stage)) {
    return {
      status: "needs-onboarding",
      userId,
      profileId: data.id,
      onboardingStage: data.onboarding_stage,
      needsBirthdate: false
    };
  }
  return { status: "ready", userId, profileId: data.id, onboardingStage: null, needsBirthdate: false };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  userId: null,
  profileId: null,
  onboardingStage: null,
  needsBirthdate: false,
  hydrate: async () => {
    if (!isSupabaseConfigured) {
      set({ status: "ready", session: null, userId: "mock-user", profileId: "mock-user" });
      return;
    }
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (session && (await checkSessionAgainstServer()) === "invalid") {
      await dropInvalidSession();
      session = null;
    }
    const resolved = await resolveStatusForSession(session);
    set({ session, ...resolved });
  },
  revalidate: async () => {
    if (!isSupabaseConfigured || !get().session) {
      return;
    }
    if ((await checkSessionAgainstServer()) === "invalid") {
      await dropInvalidSession();
      set({
        status: "signed-out",
        session: null,
        userId: null,
        profileId: null,
        onboardingStage: null,
        needsBirthdate: false
      });
    }
  },
  setSession: async (session) => {
    const resolved = await resolveStatusForSession(session);
    set({ session, ...resolved });
  },
  markProfileCreated: (profileId) => {
    set({ status: "needs-onboarding", onboardingStage: "permissions", profileId, needsBirthdate: false });
  },
  setOnboardingStage: (stage) => {
    if (stage === "complete") {
      set({ status: "ready", onboardingStage: null });
    } else {
      set({ status: "needs-onboarding", onboardingStage: stage });
    }
  },
  signOut: async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    set({
      status: "signed-out",
      session: null,
      userId: null,
      profileId: null,
      onboardingStage: null,
      needsBirthdate: false
    });
  }
}));

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    void useAuthStore.getState().setSession(session);
  });
}
