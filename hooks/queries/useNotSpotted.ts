import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** One friend's "did they show up today" state, from friends_not_spotted_today(). */
export type NotSpottedFriend = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  /** Trained today (their local day): gym_days ledger or any post. */
  went_today: boolean;
  /** Declared today a rest day — not taunt-able. */
  rest_today: boolean;
  current_streak: number;
  taunted_by_me_today: boolean;
  /** My taunt today was answered with a post. */
  answered: boolean;
  taunt_id: string | null;
};

export const NOT_SPOTTED_KEY = "not-spotted";

/**
 * Every accepted friend + whether they've trained today, in ONE server read.
 * Each friend's day boundary is THEIR timezone (the old client queries used
 * this device's midnight for everyone), and "went" reads the gym_days ledger
 * so a deleted post doesn't un-spot someone.
 */
export function useNotSpotted() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: [NOT_SPOTTED_KEY, userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<NotSpottedFriend[]> => {
      const { data, error } = await supabase.rpc("friends_not_spotted_today");
      if (error) throw error;
      return (data ?? []) as NotSpottedFriend[];
    }
  });
}

/**
 * Rail order: the people a taunt can still change come first.
 *   1. not spotted, streak at risk (longest streak first — most to lose)
 *   2. not spotted, no streak
 *   3. taunted by me, waiting
 *   4. answered / went today (gold ✓, social proof at the end)
 * Rest days are hidden — a declared rest day is an answer, not an absence.
 */
export function orderForRail(friends: NotSpottedFriend[]): NotSpottedFriend[] {
  const rank = (f: NotSpottedFriend) => {
    if (f.went_today) return 3;
    if (f.taunted_by_me_today) return 2;
    return f.current_streak > 0 ? 0 : 1;
  };
  return friends
    .filter((f) => !f.rest_today)
    .sort((a, b) => rank(a) - rank(b) || b.current_streak - a.current_streak || a.username.localeCompare(b.username));
}

/** A taunt I received today (my local day), sender attached. */
export type ReceivedTaunt = {
  taunt_id: string;
  sender_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  line_id: string;
  sent_at: string;
  answered: boolean;
};

export const TAUNTS_RECEIVED_KEY = "taunts-received-today";

/** Who taunted me today — the LockOverlay "3 friends are waiting" strip. */
export function useTauntsReceivedToday(enabled = true) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: [TAUNTS_RECEIVED_KEY, userId],
    enabled: enabled && isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<ReceivedTaunt[]> => {
      const { data, error } = await supabase.rpc("my_taunts_received_today");
      if (error) throw error;
      return (data ?? []) as ReceivedTaunt[];
    }
  });
}
