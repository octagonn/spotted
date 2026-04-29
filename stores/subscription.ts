import { create } from "zustand";

import type { SubscriptionTier } from "@/types/domain";

type SubscriptionStore = {
  tier: SubscriptionTier;
  expiresAt: string | null;
  premiumSince: string | null;
  setSubscription: (tier: SubscriptionTier, expiresAt: string | null, premiumSince: string | null) => void;
};

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  tier: "free",
  expiresAt: null,
  premiumSince: null,
  setSubscription: (tier, expiresAt, premiumSince) => set({ tier, expiresAt, premiumSince })
}));
