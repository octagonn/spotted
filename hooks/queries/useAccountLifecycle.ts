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

/**
 * Run the data export (§8): the export-data edge function gathers everything
 * belonging to this user, zips it, and emails it via Resend. Rate limiting
 * (1 per 30 days) is enforced SERVER-side; the client just maps the 429.
 */
export function useRequestDataExport() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase.functions.invoke("export-data", { method: "POST" });
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        throw new Error(status === 429 ? "rate_limited" : "export_failed");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["data-export-latest", userId] })
  });
}
