import { useQuery } from "@tanstack/react-query";

import { mockProfileSignals, mockSkipSignals } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { ProfileSignal } from "@/types/domain";

export function useProfileSignals() {
  const profileId = useAuthStore((state) => state.profileId);
  return useQuery({
    queryKey: ["profile-signals", profileId],
    enabled: !isSupabaseConfigured || Boolean(profileId),
    queryFn: async (): Promise<ProfileSignal[]> => {
      if (!isSupabaseConfigured) {
        return mockProfileSignals;
      }
      if (!profileId) {
        return [];
      }
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [total, recent] = await Promise.all([
        supabase
          .from("profile_views")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId),
        supabase
          .from("profile_views")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId)
          .gte("viewed_at", dayAgo)
      ]);
      if (total.error) {
        throw total.error;
      }
      if (recent.error) {
        throw recent.error;
      }
      const totalCount = total.count ?? 0;
      if (totalCount === 0) {
        return [];
      }
      const recentCount = recent.count ?? 0;
      return [
        {
          label: "PROFILE VIEWS",
          value: String(totalCount),
          detail: recentCount > 0 ? `${recentCount} in the last day` : "Quiet lately"
        }
      ];
    }
  });
}

export type SkipSignal = {
  id: string;
  display_name: string;
  muscle: string;
  body: string;
};

type SkipEventRow = {
  id: string;
  user_id: string;
  muscle_groups_missed: string[];
  scheduled_date: string;
  profile: { display_name: string } | null;
};

export function useSkipSignals() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["skip-signals", userId],
    enabled: !isSupabaseConfigured || Boolean(userId),
    queryFn: async (): Promise<SkipSignal[]> => {
      if (!isSupabaseConfigured) {
        return [...mockSkipSignals];
      }
      if (!userId) {
        return [];
      }
      const { data, error } = await supabase
        .from("skip_events")
        .select("id, user_id, muscle_groups_missed, scheduled_date, profile:user_id(display_name)")
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as SkipEventRow[];
      return rows.map((row) => {
        const name = row.profile?.display_name ?? "Someone";
        const muscle = row.muscle_groups_missed.length > 0 ? row.muscle_groups_missed.join(" + ") : "gym";
        return {
          id: row.id,
          display_name: name,
          muscle,
          body: `${name} missed ${muscle.toLowerCase()} day. Quiet, but everybody saw it.`
        };
      });
    }
  });
}

export function useGymDaysCount() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["gym-days", userId],
    enabled: !isSupabaseConfigured || Boolean(userId),
    queryFn: async (): Promise<number> => {
      if (!isSupabaseConfigured) {
        return 38;
      }
      if (!userId) {
        return 0;
      }
      const { count, error } = await supabase
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) {
        throw error;
      }
      return count ?? 0;
    }
  });
}
