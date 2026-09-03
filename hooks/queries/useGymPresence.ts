import { useQuery } from "@tanstack/react-query";

import { mockFriendPresence, mockGyms } from "@/lib/mockData";
import { isDemoMode, supabase } from "@/lib/supabase";
import type { FriendPresence, Gym, Profile } from "@/types/domain";

type CheckinRow = {
  id: string;
  user_id: string;
  gym_id: string;
  checked_in_at: string;
  profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
  gyms: Pick<Gym, "id" | "name" | "latitude" | "longitude"> | null;
};

export function useGymPresence() {
  return useQuery({
    queryKey: ["gym-presence"],
    queryFn: async (): Promise<{ presence: FriendPresence[] }> => {
      if (isDemoMode) {
        return { presence: mockFriendPresence };
      }
      // NOTE: no gyms-table fetch here — with US-wide coverage that table is
      // tens of thousands of rows. The checkins join embeds each row's gym.
      const checkinsResult = await supabase
        .from("checkins")
        .select(
          "id, user_id, gym_id, checked_in_at, profiles:user_id(id, username, display_name, avatar_url), gyms:gym_id(id, name, latitude, longitude)"
        )
        .is("checked_out_at", null);
      if (checkinsResult.error) {
        throw checkinsResult.error;
      }
      const rows = (checkinsResult.data ?? []) as unknown as CheckinRow[];
      const presence: FriendPresence[] = [];
      for (const row of rows) {
        if (!row.profiles || !row.gyms) continue;
        presence.push({
          id: row.id,
          checked_in_at: row.checked_in_at,
          profile: row.profiles,
          gym: row.gyms
        });
      }
      return { presence };
    }
  });
}

/** One gym by id — for the gym detail screen (never the whole table). */
export function useGym(gymId?: string | null) {
  return useQuery({
    queryKey: ["gym", gymId],
    enabled: Boolean(gymId),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Gym | null> => {
      if (isDemoMode) {
        return mockGyms.find((g) => g.id === gymId) ?? mockGyms[0] ?? null;
      }
      const { data, error } = await supabase
        .from("gyms")
        .select("*")
        .eq("id", gymId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as Gym) ?? null;
    }
  });
}
