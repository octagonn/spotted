import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Gym, Profile } from "@/types/domain";

/**
 * Data layer for the Communities tab revamp (spotted-communities-spec):
 * live friend presence + waves, the pinned home-gym hub, crew activity
 * (last message / unread / quiet-state), nudges, and nearby friend gyms.
 */

/* ----------------------------- live presence ------------------------------ */

export type LivePresenceRow = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  gymId: string;
  gymName: string;
  /** Minutes since check-in (presence is time-boxed to 2h — never permanent). */
  minutes: number;
};

/** Friends checked in within the last 2 hours (spec: presence is time-boxed). */
export function useLiveFriendPresence() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: ["live-presence", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<LivePresenceRow[]> => {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("checkins")
        .select(
          "user_id, gym_id, checked_in_at, profiles:user_id(id, username, display_name, avatar_url), gyms:gym_id(id, name)"
        )
        .is("checked_out_at", null)
        .gt("checked_in_at", cutoff)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      const rows: LivePresenceRow[] = [];
      const seen = new Set<string>();
      for (const row of (data ?? []) as unknown as {
        user_id: string;
        gym_id: string;
        checked_in_at: string;
        profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
        gyms: Pick<Gym, "id" | "name"> | null;
      }[]) {
        // RLS already scopes to self + friends; drop self and duplicates.
        if (row.user_id === userId || !row.profiles || !row.gyms || seen.has(row.user_id)) continue;
        seen.add(row.user_id);
        rows.push({
          userId: row.user_id,
          displayName: row.profiles.display_name,
          username: row.profiles.username,
          avatarUrl: row.profiles.avatar_url,
          gymId: row.gym_id,
          gymName: row.gyms.name,
          minutes: Math.max(0, Math.round((Date.now() - new Date(row.checked_in_at).getTime()) / 60_000))
        });
      }
      return rows;
    }
  });
}

/** Wave at a friend who's at the gym right now (server rate-limits repeats). */
export function useWave() {
  return useMutation({
    mutationFn: async ({ targetId, gymName }: { targetId: string; gymName?: string | null }) => {
      const { error } = await supabase.rpc("wave_at_friend", { target: targetId, gym_name: gymName ?? null });
      if (error) throw error;
    }
  });
}

/* ----------------------------- home gym hub ------------------------------- */

export type HomeGymHub = {
  /** The gym's community, if one exists yet. */
  communityId: string | null;
  memberCount: number;
  checkedInToday: number;
  /** Latest visible message in the gym community — omitted when unknown
   *  (spec: no fake activity). */
  lastActivity: { senderName: string; preview: string; sentAt: string } | null;
};

export function useHomeGymHub(homeGymId?: string | null) {
  return useQuery({
    queryKey: ["home-gym-hub", homeGymId ?? null],
    enabled: isSupabaseConfigured && Boolean(homeGymId),
    staleTime: 30_000,
    queryFn: async (): Promise<HomeGymHub> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [communityResult, checkinsResult] = await Promise.all([
        supabase
          .from("communities")
          .select("id, members:community_members(count)")
          .eq("gym_id", homeGymId as string)
          .eq("type", "gym")
          .maybeSingle(),
        supabase
          .from("checkins")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", homeGymId as string)
          .gte("checked_in_at", startOfDay.toISOString())
      ]);
      if (communityResult.error) throw communityResult.error;
      const community = communityResult.data as unknown as { id: string; members?: { count: number }[] } | null;

      let lastActivity: HomeGymHub["lastActivity"] = null;
      if (community) {
        const { data: msg } = await supabase
          .from("community_messages")
          .select("content, sent_at, sender:sender_id(display_name)")
          .eq("community_id", community.id)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const row = msg as unknown as { content: string; sent_at: string; sender: { display_name: string } | null } | null;
        if (row?.sender) {
          lastActivity = { senderName: row.sender.display_name, preview: row.content, sentAt: row.sent_at };
        }
      }
      return {
        communityId: community?.id ?? null,
        memberCount: community?.members?.[0]?.count ?? 0,
        checkedInToday: checkinsResult.count ?? 0,
        lastActivity
      };
    }
  });
}

/* ----------------------------- crew activity ------------------------------ */

export type CrewActivity = {
  /** Latest message (sender first name + preview) — null if the crew is silent. */
  last: { senderId: string; senderName: string; preview: string; sentAt: string } | null;
  /** Full days since the last message (Infinity when there's never been one). */
  daysQuiet: number;
  unread: boolean;
};

/** Last-message + unread state for each of the user's communities. */
export function useCrewActivity(communityIds: string[]) {
  const userId = useAuthStore((s) => s.userId);
  const key = [...communityIds].sort().join(",");
  return useQuery({
    queryKey: ["crew-activity", userId, key],
    enabled: isSupabaseConfigured && Boolean(userId) && communityIds.length > 0,
    staleTime: 20_000,
    queryFn: async (): Promise<Record<string, CrewActivity>> => {
      const [messagesResult, membershipResult] = await Promise.all([
        supabase
          .from("community_messages")
          .select("community_id, sender_id, content, sent_at, sender:sender_id(display_name)")
          .in("community_id", communityIds)
          .order("sent_at", { ascending: false })
          .limit(120),
        supabase
          .from("community_members")
          .select("community_id, last_read_at")
          .eq("user_id", userId as string)
          .in("community_id", communityIds)
      ]);
      if (messagesResult.error) throw messagesResult.error;
      if (membershipResult.error) throw membershipResult.error;

      const lastRead: Record<string, string> = {};
      for (const row of membershipResult.data ?? []) {
        lastRead[row.community_id] = (row as { community_id: string; last_read_at: string }).last_read_at;
      }

      const out: Record<string, CrewActivity> = {};
      for (const id of communityIds) {
        out[id] = { last: null, daysQuiet: Number.POSITIVE_INFINITY, unread: false };
      }
      for (const row of (messagesResult.data ?? []) as unknown as {
        community_id: string;
        sender_id: string;
        content: string;
        sent_at: string;
        sender: { display_name: string } | null;
      }[]) {
        const entry = out[row.community_id];
        if (!entry || entry.last) continue; // keep only the newest per community
        entry.last = {
          senderId: row.sender_id,
          senderName: row.sender?.display_name ?? "Someone",
          preview: row.content,
          sentAt: row.sent_at
        };
        entry.daysQuiet = Math.floor((Date.now() - new Date(row.sent_at).getTime()) / 86_400_000);
        const read = lastRead[row.community_id];
        entry.unread = row.sender_id !== userId && (!read || row.sent_at > read);
      }
      return out;
    }
  });
}

/** Mark a community read (clears the unread dot). */
export function useMarkCommunityRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  return useMutation({
    mutationFn: async (communityId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("community_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("community_id", communityId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["crew-activity"] })
  });
}

/* -------------------------------- nudges ---------------------------------- */

/** Communities the user has already nudged in the last 24h (rate-limit state). */
export function useMyRecentNudges() {
  const userId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: ["my-nudges", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("community_nudges")
        .select("community_id")
        .eq("user_id", userId as string)
        .gt("created_at", cutoff);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.community_id));
    }
  });
}

/** Send a nudge (server enforces the 24h limit + pushes quiet members only). */
export function useNudgeCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId: string): Promise<number> => {
      const { data, error } = await supabase.rpc("nudge_community", { cid: communityId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-nudges"] })
  });
}

/* --------------------------- discover near you ---------------------------- */

export type NearbyFriendGym = {
  gymId: string;
  name: string;
  friendCount: number;
  /** Miles from the user, when their location is known. */
  distanceMi: number | null;
};

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Gyms where at least one friend trains (their home gym), excluding the
 * user's own home gym. Spec: hide the whole section when this is empty —
 * "0 friends train here" signals a dead app.
 */
export function useNearbyFriendGyms(
  friendGymIds: (string | null)[],
  homeGymId?: string | null,
  coords?: { latitude: number; longitude: number } | null
) {
  const counts = new Map<string, number>();
  for (const id of friendGymIds) {
    if (!id || id === homeGymId) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const ids = [...counts.keys()].sort();
  return useQuery({
    queryKey: ["nearby-friend-gyms", ids.join(","), coords?.latitude ?? null, coords?.longitude ?? null],
    enabled: isSupabaseConfigured && ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<NearbyFriendGym[]> => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name, latitude, longitude")
        .in("id", ids);
      if (error) throw error;
      const rows: NearbyFriendGym[] = (data ?? []).map((gym) => ({
        gymId: gym.id,
        name: gym.name,
        friendCount: counts.get(gym.id) ?? 0,
        distanceMi: coords ? haversineMiles(coords.latitude, coords.longitude, gym.latitude, gym.longitude) : null
      }));
      rows.sort(
        (a, b) => b.friendCount - a.friendCount || (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity)
      );
      return rows.slice(0, 5);
    }
  });
}
