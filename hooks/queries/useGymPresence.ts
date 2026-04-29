import { useQuery } from "@tanstack/react-query";

import { mockFriendPresence, mockGyms } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useGymPresence() {
  return useQuery({
    queryKey: ["gym-presence"],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return { gyms: mockGyms, presence: mockFriendPresence };
      }
      const { data, error } = await supabase.from("checkins").select("*").is("checked_out_at", null);
      if (error) {
        throw error;
      }
      return { gyms: mockGyms, presence: mockFriendPresence };
    }
  });
}
