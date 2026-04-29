import { useQuery } from "@tanstack/react-query";

import { mockProfiles } from "@/lib/mockData";
import { reconcileSubscription } from "@/lib/subscription";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return reconcileSubscription(
          {
            tier: "free",
            expiresAt: null,
            premiumSince: null
          },
          new Date()
        );
      }
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) {
        return { tier: "free" as const, expiresAt: null, premiumSince: null };
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_expires_at, premium_since")
        .eq("id", userId)
        .single();
      if (error) {
        throw error;
      }
      return reconcileSubscription(
        {
          tier: data.subscription_tier,
          expiresAt: data.subscription_expires_at,
          premiumSince: data.premium_since
        },
        new Date()
      );
    }
  });
}
