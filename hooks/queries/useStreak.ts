import { useQuery } from "@tanstack/react-query";

import { mockStreak } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useStreak() {
  return useQuery({
    queryKey: ["streak"],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockStreak;
      }
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) {
        return mockStreak;
      }
      const { data, error } = await supabase.from("streaks").select("*").eq("user_id", userId).single();
      if (error) {
        throw error;
      }
      return data;
    }
  });
}
