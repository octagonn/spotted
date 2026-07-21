import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore, type OnboardingStage } from "@/stores/auth";

/**
 * Persist the user's onboarding position so a relaunch resumes at the right
 * step. The DB write is best-effort: navigation never blocks on it — worst
 * case a relaunch repeats one step.
 */
export async function advanceOnboarding(userId: string | null, stage: OnboardingStage | "complete"): Promise<void> {
  useAuthStore.getState().setOnboardingStage(stage);
  if (!isSupabaseConfigured || !userId) {
    return;
  }
  const { error } = await supabase.from("profiles").update({ onboarding_stage: stage }).eq("id", userId);
  if (error) {
    logger.warn("onboarding_stage_update_failed", { stage, message: error.message });
  }
}
