import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

export type SafetyRow = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  since: string;
};

type JoinRow = {
  created_at: string;
  profile: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
};

function mapRows(rows: JoinRow[]): SafetyRow[] {
  return rows
    .filter((r) => r.profile)
    .map((r) => ({
      id: r.profile!.id,
      username: r.profile!.username,
      displayName: r.profile!.display_name,
      avatarUrl: r.profile!.avatar_url,
      since: r.created_at
    }));
}

/** Accounts the signed-in user has blocked (§5 list screen). */
export function useBlockedAccounts() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["blocked-accounts", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<SafetyRow[]> => {
      const { data, error } = await supabase
        .from("user_blocks")
        .select("created_at, profile:blocked_id(id, username, display_name, avatar_url)")
        .eq("blocker_id", userId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return mapRows((data ?? []) as unknown as JoinRow[]);
    }
  });
}

/** Accounts the signed-in user has restricted (§6 list screen). */
export function useRestrictedAccounts() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["restricted-accounts", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<SafetyRow[]> => {
      const { data, error } = await supabase
        .from("restrictions")
        .select("created_at, profile:restricted_id(id, username, display_name, avatar_url)")
        .eq("restrictor_id", userId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return mapRows((data ?? []) as unknown as JoinRow[]);
    }
  });
}

function useSafetyMutation(rpc: "block_user" | "unblock_user" | "restrict_user" | "unrestrict_user") {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.rpc(rpc, { p_target: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of [
        "blocked-accounts",
        "restricted-accounts",
        "blocked-users",
        "friends",
        "friend-suggestions",
        "feed"
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      void queryClient.invalidateQueries({ queryKey: ["blocked-accounts", userId] });
    }
  });
}

export const useBlockUser = () => useSafetyMutation("block_user");
export const useUnblockUser = () => useSafetyMutation("unblock_user");
export const useRestrictUser = () => useSafetyMutation("restrict_user");
export const useUnrestrictUser = () => useSafetyMutation("unrestrict_user");
