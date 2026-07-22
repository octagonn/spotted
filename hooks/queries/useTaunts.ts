import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** Start of the local day, as a UTC instant — the server's "today" boundary. */
export function localMidnightUtc(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Human message for each server-side taunt rejection. */
export const TAUNT_ERRORS: Record<string, string> = {
  not_friends: "You can only taunt friends",
  sender_not_posted: "Post your own SPOTTED first, then talk",
  target_already_posted: "Too late — they already posted today",
  daily_send_limit: "5 taunts a day is plenty. Save some for tomorrow",
  already_taunted_target: "You already taunted them today",
  target_quiet_hours: "It's past 9pm for them — let them sleep"
};

/** Send a canned-line taunt (server validates everything — spec B). */
export function useSendTaunt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, lineId, lineText }: { targetId: string; lineId: string; lineText: string }) => {
      const { error } = await supabase.rpc("send_taunt_line", {
        p_target: targetId,
        p_line_id: lineId,
        p_line_text: lineText,
        p_since: localMidnightUtc()
      });
      if (error) {
        const key = Object.keys(TAUNT_ERRORS).find((k) => error.message.includes(k));
        throw new Error(key ? TAUNT_ERRORS[key] : "Couldn't send the taunt");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-taunts-today"] })
  });
}

/** Targets the user already taunted today + total sent (drives picker state). */
export function useMyTauntsToday() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["my-taunts-today", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<{ targets: Set<string>; sent: number }> => {
      const { data, error } = await supabase
        .from("taunts")
        .select("target_id")
        .eq("sender_id", userId as string)
        .gte("sent_at", localMidnightUtc());
      if (error) throw error;
      const rows = data ?? [];
      return { targets: new Set(rows.map((r) => r.target_id)), sent: rows.length };
    }
  });
}
