import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Profile } from "@/types/domain";

// NOTE: Follow was removed from the product (single friends model). This file
// keeps only the friend-graph helpers that lived here; the `follows` table is
// inert in the DB.

/** Accepted friends of any user (via SECURITY DEFINER RPC). */
export function useUserFriends(userId?: string | null) {
  return useQuery({
    queryKey: ["user-friends", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.rpc("user_friends", { uid: userId as string });
      if (error) throw error;
      return (data ?? []) as Profile[];
    }
  });
}

/**
 * Batch mutual-friend counts for a page of people rows (find friends, search,
 * added-me) — ONE round-trip via the mutual_friend_counts RPC. Returns a
 * userId → count map. Capped server-side at 100 ids.
 */
export function useMutualCounts(ids: string[]) {
  const authedId = useAuthStore((state) => state.userId);
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["mutual-counts", authedId, sorted.join(",")],
    enabled: isSupabaseConfigured && Boolean(authedId) && sorted.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc("mutual_friend_counts", { p_ids: sorted.slice(0, 100) });
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { user_id: string; mutual_count: number | string }[]) {
        map[row.user_id] = Number(row.mutual_count) || 0;
      }
      return map;
    }
  });
}

/** Friends shared by the current user and `targetId`. */
export function useMutualFriends(targetId?: string | null) {
  const authedId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["mutual-friends", authedId, targetId],
    enabled: isSupabaseConfigured && Boolean(authedId) && Boolean(targetId) && authedId !== targetId,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.rpc("mutual_friends", { uid: targetId as string });
      if (error) throw error;
      return (data ?? []) as Profile[];
    }
  });
}
