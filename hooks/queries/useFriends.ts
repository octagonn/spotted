import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mockProfiles, mockSuggestions } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { FriendSuggestion, Profile } from "@/types/domain";

export function useFriends() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    // Keyed by userId so a different account can't read this one's cached list.
    queryKey: ["friends", userId],
    queryFn: async (): Promise<Profile[]> => {
      if (!isSupabaseConfigured) {
        return mockProfiles.slice(1);
      }
      // Local session state — auth.getUser() is a network round-trip per call.
      const userId = useAuthStore.getState().userId;
      if (!userId) {
        return [];
      }
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "user_id, friend_id, status, friend:friend_id(id, username, display_name, avatar_url, avatar_blurred_url, bio, home_gym_id, created_at), inviter:user_id(id, username, display_name, avatar_url, avatar_blurred_url, bio, home_gym_id, created_at)"
        )
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (error) {
        throw error;
      }
      const profiles: Profile[] = [];
      for (const row of data ?? []) {
        const partner =
          row.user_id === userId
            ? (row as unknown as { friend: Profile | null }).friend
            : (row as unknown as { inviter: Profile | null }).inviter;
        if (partner) {
          profiles.push(partner);
        }
      }
      return profiles;
    }
  });
}

/** Live people search across all discoverable profiles (Find Friends search bar). */
export function useSearchPeople(query: string) {
  const cleaned = query.trim().replace(/[%,()]/g, "");
  return useQuery({
    queryKey: ["people-search", cleaned.toLowerCase()],
    enabled: isSupabaseConfigured && cleaned.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<Pick<Profile, "id" | "username" | "display_name" | "avatar_url">[]> => {
      // Local session state — auth.getUser() is a network round-trip per call.
      const userId = useAuthStore.getState().userId;
      // Typo-tolerant trigram search, similarity-ranked (pg_trgm RPC).
      const { data, error } = await supabase.rpc("search_profiles_fuzzy", { q: cleaned, max_rows: 20 });
      if (error) {
        throw error;
      }
      return (data ?? []).filter((profile) => profile.id !== userId);
    }
  });
}

export function useFriendSuggestions() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["friend-suggestions", userId],
    queryFn: async (): Promise<FriendSuggestion[]> => {
      if (!isSupabaseConfigured) {
        return mockSuggestions;
      }
      const { data, error } = await supabase.functions.invoke<{ suggestions: FriendSuggestion[] }>(
        "get-friend-suggestions",
        { body: { limit: 8 } }
      );
      if (error) {
        throw error;
      }
      return data?.suggestions ?? [];
    }
  });
}

export type IncomingRequest = {
  requesterId: string;
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
};

export function useIncomingRequests() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["friend-requests", userId],
    queryFn: async (): Promise<IncomingRequest[]> => {
      if (!isSupabaseConfigured) {
        return [];
      }
      // Local session state — auth.getUser() is a network round-trip per call.
      const userId = useAuthStore.getState().userId;
      if (!userId) {
        return [];
      }
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id, inviter:user_id(id, username, display_name, avatar_url)")
        .eq("status", "pending")
        .eq("friend_id", userId);
      if (error) {
        throw error;
      }
      return (data ?? [])
        .map((row) => {
          const profile = (row as unknown as { inviter: IncomingRequest["profile"] | null }).inviter;
          return profile ? { requesterId: row.user_id, profile } : null;
        })
        .filter((request): request is IncomingRequest => request !== null);
    }
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ requesterId, accept }: { requesterId: string; accept: boolean }) => {
      if (!isSupabaseConfigured) {
        return;
      }
      // Local auth state — supabase.auth.getUser() here was a full network
      // round-trip to the auth server per tap (the "10s to accept" lag).
      const userId = authUserId ?? useAuthStore.getState().userId;
      if (!userId) {
        return;
      }
      const { error } = accept
        ? await supabase
            .from("friendships")
            .update({ status: "accepted" })
            .eq("user_id", requesterId)
            .eq("friend_id", userId)
            .eq("status", "pending")
        : await supabase
            .from("friendships")
            .delete()
            .eq("user_id", requesterId)
            .eq("friend_id", userId)
            .eq("status", "pending");
      if (error) {
        throw error;
      }
    },
    // Optimistic: the request row disappears the instant the button is tapped.
    onMutate: async ({ requesterId }) => {
      await queryClient.cancelQueries({ queryKey: ["friend-requests"] });
      const prev = queryClient.getQueriesData<IncomingRequest[]>({ queryKey: ["friend-requests"] });
      queryClient.setQueriesData<IncomingRequest[]>({ queryKey: ["friend-requests"] }, (old) =>
        (old ?? []).filter((request) => request.requesterId !== requesterId)
      );
      return { prev };
    },
    onError: (_error, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      // Fire-and-forget refresh — nothing blocks the UI on these refetches.
      void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["user-counts"] });
    }
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }
      // Local session state — auth.getUser() is a network round-trip per call.
      const userId = useAuthStore.getState().userId;
      if (!userId) {
        return;
      }
      const { error } = await supabase
        .from("friendships")
        .insert({ user_id: userId, friend_id: friendId, status: "pending" });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["friend-suggestions"] });
      await queryClient.invalidateQueries({ queryKey: ["friends"] });
    }
  });
}
