import type { SubscriptionTier } from "@/types/domain";

export type SubscriptionState = {
  tier: SubscriptionTier;
  expiresAt: string | null;
  premiumSince: string | null;
};

export function reconcileSubscription(state: SubscriptionState, now: Date) {
  if (state.tier === "plus" && state.expiresAt && new Date(state.expiresAt).getTime() <= now.getTime()) {
    return {
      tier: "free" as const,
      expiresAt: state.expiresAt,
      premiumSince: state.premiumSince
    };
  }
  return state;
}
