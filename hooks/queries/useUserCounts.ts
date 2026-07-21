import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type ProfileCounts = { friends: number; followers: number; following: number; posts: number };

/**
 * Friend / following / post counts for any user, via the SECURITY DEFINER
 * `profile_counts` RPC (friendships RLS otherwise hides other users' rows).
 */
export function useUserCounts(userId?: string | null) {
  return useQuery({
    queryKey: ["user-counts", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<ProfileCounts> => {
      const { data, error } = await supabase.rpc("profile_counts", { uid: userId as string });
      if (error) {
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        friends: row?.friends ?? 0,
        followers: row?.followers ?? 0,
        following: row?.following ?? 0,
        posts: row?.posts ?? 0
      };
    }
  });
}
