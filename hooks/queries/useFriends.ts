import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mockProfiles, mockSuggestions } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import type { FriendSuggestion, Profile } from "@/types/domain";
import type { RelationshipState } from "@/types/redesign";

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
      const rows = (data ?? []).filter((profile) => profile.id !== userId);
      trackAnalyticsEvent("people_search", { query_length: cleaned.length, results: rows.length });
      return rows;
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
      // Ask for a POOL, not a screenful. At limit 8 the client held exactly
      // what it displayed, so every X needed a server round-trip to backfill —
      // and because each dismissal invalidates, rapid X-ing coalesced those
      // refetches and only a couple of new faces ever arrived before the
      // section looked exhausted. Holding ~40 means dismissals backfill
      // instantly from memory and the list only truly ends when the candidate
      // pool really is empty.
      const { data, error } = await supabase.functions.invoke<{ suggestions: FriendSuggestion[] }>(
        "get-friend-suggestions",
        { body: { limit: 40 } }
      );
      if (error) {
        throw error;
      }
      return data?.suggestions ?? [];
    }
  });
}

/**
 * X on a Quick Add suggestion: persist the dismissal (7-day server-side
 * cooldown — the account can resurface after that) and refetch so a fresh
 * suggestion backfills the slot.
 */
export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (dismissedId: string) => {
      if (!isSupabaseConfigured || !userId) return;
      // Upsert refreshes dismissed_at, re-arming the cooldown on a repeat X.
      const { error } = await supabase
        .from("suggestion_dismissals")
        .upsert({ user_id: userId, dismissed_id: dismissedId, dismissed_at: new Date().toISOString() });
      if (error) throw error;
      trackAnalyticsEvent("suggestion_dismissed");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["friend-suggestions", userId] })
  });
}

/**
 * Clears every suggestion you've X'd, so the list runs from the top again.
 *
 * In a user base this size you can genuinely reach the end of the candidate
 * pool, and an empty "Suggested" section reads as broken rather than finished.
 * This backs the "Start over" action on that empty state. RLS
 * (suggestion_dismissals_delete_self) already scopes the delete to your own
 * rows, so this needs no RPC.
 */
export function useResetSuggestions() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase.from("suggestion_dismissals").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["friend-suggestions", userId] })
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
      trackAnalyticsEvent("friend_request_responded", { accepted: accept });
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
      // Accepting flips RLS visibility for EVERYTHING on the new friend's
      // profile — but the locked view was already cached, so their page stayed
      // "private" until an app restart. Refresh every gate and everything
      // behind it (posts, streak, tagged, mutuals) so the profile opens
      // unlocked immediately.
      void queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
      void queryClient.invalidateQueries({ queryKey: ["friendship-states"] });
      void queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["signed-user-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["streak-days"] });
      void queryClient.invalidateQueries({ queryKey: ["streak"] });
      void queryClient.invalidateQueries({ queryKey: ["tagged-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["mutual-friends"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
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
      trackAnalyticsEvent("friend_request_sent");
    },
    // Optimistic: the suggestion card flips to "requested" (drops out of the
    // list) the instant the button is tapped.
    onMutate: async (friendId) => {
      await queryClient.cancelQueries({ queryKey: ["friend-suggestions"] });
      const prev = queryClient.getQueriesData<FriendSuggestion[]>({ queryKey: ["friend-suggestions"] });
      queryClient.setQueriesData<FriendSuggestion[]>({ queryKey: ["friend-suggestions"] }, (old) =>
        (old ?? []).filter((suggestion) => suggestion.id !== friendId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't send the friend request");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-suggestions"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      // Adding someone who already requested you ACCEPTS their request
      // (server-side collapse) — refresh every relationship read so the
      // button flips to "Friends" instead of sitting on "Requested".
      void queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["friendship-status"] });
      void queryClient.invalidateQueries({ queryKey: ["friendship-states"] });
      void queryClient.invalidateQueries({ queryKey: ["user-counts"] });
    }
  });
}

/**
 * Relationship state for a page of people, in one query.
 *
 * People lists (someone else's friends, mutuals) used to show a bare
 * "Message" button for everyone — you couldn't tell who you were already
 * friends with, and there was no way to add the ones you weren't. This maps
 * each id to friend / requested / incoming / none so a list row can show the
 * right action.
 */
export function useFriendshipStates(ids: string[]) {
  const userId = useAuthStore((state) => state.userId);
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["friendship-states", userId, sorted.join(",")],
    enabled: isSupabaseConfigured && Boolean(userId) && sorted.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<Map<string, RelationshipState>> => {
      const me = userId as string;
      const list = sorted.slice(0, 200);
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id, friend_id, status")
        .or(`and(user_id.eq.${me},friend_id.in.(${list.join(",")})),and(friend_id.eq.${me},user_id.in.(${list.join(",")}))`);
      if (error) throw error;
      const out = new Map<string, RelationshipState>();
      for (const row of (data ?? []) as { user_id: string; friend_id: string; status: string }[]) {
        const other = row.user_id === me ? row.friend_id : row.user_id;
        if (row.status === "accepted") out.set(other, "friend");
        // Pending: I sent it (outgoing) vs they sent it (incoming).
        else if (row.status === "pending") out.set(other, row.user_id === me ? "requested" : "incoming");
      }
      return out;
    }
  });
}

export type OutgoingRequest = {
  targetId: string;
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;
};

/**
 * Friend requests YOU sent that are still pending.
 *
 * Only the incoming direction existed, so a sent request vanished into nothing
 * — you couldn't tell whether it went through, and couldn't take it back.
 */
export function useOutgoingRequests() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["friend-requests-sent", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<OutgoingRequest[]> => {
      if (!isSupabaseConfigured || !userId) return [];
      const { data, error } = await supabase
        .from("friendships")
        .select("friend_id, target:friend_id(id, username, display_name, avatar_url)")
        .eq("status", "pending")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? [])
        .map((row) => {
          const profile = (row as unknown as { target: OutgoingRequest["profile"] | null }).target;
          return profile ? { targetId: row.friend_id, profile } : null;
        })
        .filter((request): request is OutgoingRequest => request !== null);
    }
  });
}

/** Withdraw a friend request you sent (deletes your own pending row). */
/**
 * Remove an accepted friend. The friendships row can sit in either direction
 * (whoever sent the original request is user_id), so delete both.
 */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (friendId: string) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase
        .from("friendships")
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
      if (error) throw error;
      trackAnalyticsEvent("friend_removed");
    },
    onSuccess: () => {
      // Friendship gates RLS on everything of theirs — refresh every cache
      // that read through it (mirror of useRespondToRequest.onSettled).
      for (const key of [
        "friends",
        "friendship-status",
        "friendship-states",
        "friend-suggestions",
        "user-counts",
        "user-posts",
        "signed-user-posts",
        "streak-days",
        "streak",
        "tagged-posts",
        "mutual-friends",
        "feed"
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: () => showToast("Couldn't remove — try again")
  });
}

export function useCancelFriendRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (targetId: string) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", userId)
        .eq("friend_id", targetId)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests-sent"] });
      void queryClient.invalidateQueries({ queryKey: ["friendship-states"] });
      void queryClient.invalidateQueries({ queryKey: ["friend-suggestions"] });
    },
    onError: () => showToast("Couldn't withdraw the request")
  });
}
