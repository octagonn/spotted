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
