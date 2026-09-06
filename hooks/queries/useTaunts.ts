import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { NOT_SPOTTED_KEY, type NotSpottedFriend } from "@/hooks/queries/useNotSpotted";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";

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
  target_already_posted: "Too late — they already showed up today",
  target_rest_day: "They called a rest day. Let them have it",
  target_quiet_hours: "It's outside 7am–10pm for them — try later",
  daily_send_limit: "15 taunts a day is plenty. Save some for tomorrow",
  already_taunted_target: "You already taunted them today"
};

/** Where the taunt was sent from — the rail is the surface we're measuring. */
export type TauntSource = "rail" | "friends_list" | "profile" | "inbox";

type SendTauntVars = { targetId: string; lineId: string; lineText: string; source?: TauntSource };

/** Send a canned-line taunt (server validates everything — spec B). */
export function useSendTaunt() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ targetId, lineId, lineText, source }: SendTauntVars) => {
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
      trackAnalyticsEvent("taunt_sent", { source: source ?? "friends_list" });
    },
    // Optimistic: the rail tile / picker row flips to "taunted" + the daily
    // count bumps instantly. Server rejections roll back with the human error
    // as a toast.
    onMutate: async ({ targetId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["my-taunts-today", userId] }),
        queryClient.cancelQueries({ queryKey: [NOT_SPOTTED_KEY, userId] })
      ]);
      const prev = queryClient.getQueryData<{ targets: Set<string>; sent: number }>(["my-taunts-today", userId]);
      const prevRail = queryClient.getQueryData<NotSpottedFriend[]>([NOT_SPOTTED_KEY, userId]);
      queryClient.setQueryData<{ targets: Set<string>; sent: number }>(["my-taunts-today", userId], (old) => ({
        targets: new Set([...(old?.targets ?? []), targetId]),
        sent: (old?.sent ?? 0) + 1
      }));
      queryClient.setQueryData<NotSpottedFriend[]>([NOT_SPOTTED_KEY, userId], (old) =>
        old?.map((f) => (f.user_id === targetId ? { ...f, taunted_by_me_today: true } : f))
      );
      return { prev, prevRail };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["my-taunts-today", userId], ctx.prev);
      if (ctx?.prevRail) queryClient.setQueryData([NOT_SPOTTED_KEY, userId], ctx.prevRail);
      showToast(error instanceof Error ? error.message : "Couldn't send the taunt");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-taunts-today"] });
      void queryClient.invalidateQueries({ queryKey: [NOT_SPOTTED_KEY] });
    }
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
