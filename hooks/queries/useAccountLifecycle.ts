import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** Deactivate (temporary hide; streak freezes, no deletion countdown). */
export function useDeactivateAccount() {
  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.rpc("deactivate_account");
      if (error) throw error;
    }
  });
}

/** Request 30-day deletion; returns the purge date. */
export function useRequestDeletion() {
  return useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (!isSupabaseConfigured) return null;
      const { data, error } = await supabase.rpc("request_account_deletion");
      if (error) throw error;
      return (data as string) ?? null;
    }
  });
}

/** Most recent data-export request (drives the 1-per-30-days rate limit UI). */
export function useLatestExportRequest() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["data-export-latest", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<{ requestedAt: string } | null> => {
      const { data, error } = await supabase
        .from("data_export_requests")
        .select("requested_at")
        .eq("user_id", userId as string)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { requestedAt: data.requested_at } : null;
    }
  });
}

/** File a data-export request (§8) — one per 30 days, enforced client + here. */
export function useRequestDataExport() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured || !userId) return;
      // Rate limit: reject if a request was filed in the last 30 days.
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("data_export_requests")
        .select("id")
        .eq("user_id", userId)
        .gte("requested_at", cutoff)
        .limit(1);
      if (recent && recent.length > 0) throw new Error("rate_limited");
      const { error } = await supabase
        .from("data_export_requests")
        .insert({ user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["data-export-latest", userId] })
  });
}
