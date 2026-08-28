import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";

export type RestDayResult = {
  ok: boolean;
  kind?: "rest" | null;
  day?: string;
  reason?: "not_authenticated" | "no_profile" | "already_posted" | "not_a_rest_day" | "rest_cap_reached";
  cap?: number;
};

/** Human-readable outcome for the toast — the server owns the rules. */
export function restDayMessage(result: RestDayResult): string {
  if (result.ok) {
    return result.kind === "rest" ? "Rest day logged — your streak is safe." : "Rest day removed.";
  }
  switch (result.reason) {
    case "already_posted":
      return "You already posted today.";
    case "rest_cap_reached":
      return `You've used your ${result.cap ?? 2} rest days this week.`;
    case "not_a_rest_day":
      return "Today isn't marked as a rest day.";
    default:
      return "Couldn't log your rest day — try again.";
  }
}

/**
 * Mark (or clear) today as a rest day.
 *
 * A rest day FREEZES the streak: it stops it breaking without incrementing it,
 * so the number keeps meaning "days you actually trained". All the rules —
 * today only, never over a real post, and the weekly cap — live server-side in
 * `mark_rest_day`, so a tampered client can't buy itself a streak.
 */
export function useMarkRestDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rest: boolean): Promise<RestDayResult> => {
      const { data, error } = await supabase.rpc("mark_rest_day", { p_rest: rest });
      if (error) throw error;
      return (data ?? { ok: false }) as RestDayResult;
    },
    onSuccess: (result, rest) => {
      if (!result.ok) return;
      trackAnalyticsEvent("rest_day_marked", { rest });
      // The calendar, the streak number, the split and trophies all read the
      // same ledger.
      void queryClient.invalidateQueries({ queryKey: ["streak-days"] });
      void queryClient.invalidateQueries({ queryKey: ["posted-state"] });
    }
  });
}
