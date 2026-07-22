import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { mockStreak } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export function useStreak() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["streak", userId],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockStreak;
      }
      // Local session state — auth.getUser() is a network round-trip per call.
      const userId = useAuthStore.getState().userId;
      if (!userId) {
        return mockStreak;
      }
      const { data, error } = await supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle();
      if (error) {
        throw error;
      }
      return (
        data ?? {
          user_id: userId,
          current_streak: 0,
          longest_streak: 0,
          last_checkin_date: null,
          freeze_tokens: 0
        }
      );
    }
  });
}

/**
 * Records the client-computed gym streak as a permanent high-water mark. The DB
 * only ever raises `longest_streak` (monotonic trigger), so calling this when
 * the current streak exceeds the stored longest keeps "Longest" correct even
 * after the current streak breaks and resets.
 */
export function useRecordStreakHighWater(currentStreak: number, storedLongest: number) {
  const userId = useAuthStore((state) => state.userId);
  const record = useMutation({
    mutationFn: async (value: number) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase.rpc("record_streak_high_water", { p_streak: value });
      if (error) throw error;
    }
  });
  useEffect(() => {
    if (currentStreak > storedLongest && currentStreak > 0) {
      record.mutate(currentStreak);
    }
    // Fire only when the computed streak rises past the stored high-water.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStreak, storedLongest, userId]);
}
