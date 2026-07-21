import { useQuery } from "@tanstack/react-query";

import { mockFriendPresence, mockGyms } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
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
    queryFn: async (): Promise<{ gyms: Gym[]; presence: FriendPresence[] }> => {
      if (!isSupabaseConfigured) {
        return { gyms: mockGyms, presence: mockFriendPresence };
      }
      const [gymsResult, checkinsResult] = await Promise.all([
        supabase.from("gyms").select("*").order("name"),
        supabase
          .from("checkins")
          .select(
            "id, user_id, gym_id, checked_in_at, profiles:user_id(id, username, display_name, avatar_url), gyms:gym_id(id, name, latitude, longitude)"
          )
          .is("checked_out_at", null)
      ]);
      if (gymsResult.error) {
        throw gymsResult.error;
      }
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
      return { gyms: (gymsResult.data ?? []) as Gym[], presence };
    }
  });
}
