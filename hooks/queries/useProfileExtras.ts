import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProfileWithGym } from "@/hooks/queries/useProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import type { Json } from "@/types/database";

/**
 * Cheap "does this user have an active story" check for the profile story ring —
 * a HEAD count instead of the full useStories() query (which fetches every
 * group and signs all media URLs), so the ring appears fast.
 */
export function useHasActiveStory(userId?: string | null) {
  return useQuery({
    queryKey: ["has-active-story", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId as string)
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return (count ?? 0) > 0;
    }
  });
}

export type Visibility = "public" | "friends" | "private";

/** Update the signed-in user's visibility (schedule_visibility). */
/** Pin up to 3 featured trophies to the profile header (spec C). */
export function useSetFeaturedTrophies() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (featured: { id: string; icon: string; name: string; familyName: string | null }[]) => {
      if (!userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ featured_trophies: featured.slice(0, 3) })
        .eq("id", userId);
      if (error) throw error;
    },
    // Optimistic: the pinned trophies swap in the header instantly.
    onMutate: async (featured) => {
      await queryClient.cancelQueries({ queryKey: ["profile", "me"] });
      const prev = queryClient.getQueriesData<ProfileWithGym | null>({ queryKey: ["profile", "me"] });
      queryClient.setQueriesData<ProfileWithGym | null>({ queryKey: ["profile", "me"] }, (old) =>
        old ? { ...old, featured_trophies: featured.slice(0, 3) as unknown as Json } : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't update your featured trophies");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["profile"] })
  });
}

/** Weekly split privacy (profile spec #14). */
export function useSetSplitPublic() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (value: boolean) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update({ split_public: value }).eq("id", userId);
      if (error) throw error;
    },
    // Optimistic: the privacy toggle flips instantly.
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ["profile", "me"] });
      const prev = queryClient.getQueriesData<ProfileWithGym | null>({ queryKey: ["profile", "me"] });
      queryClient.setQueriesData<ProfileWithGym | null>({ queryKey: ["profile", "me"] }, (old) =>
        old ? { ...old, split_public: value } : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't update your split privacy");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["profile"] })
  });
}

export function useSetVisibility() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (value: Visibility) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update({ schedule_visibility: value }).eq("id", userId);
      if (error) throw error;
    },
    // Optimistic: the visibility picker updates instantly.
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ["profile", "me"] });
      const prev = queryClient.getQueriesData<ProfileWithGym | null>({ queryKey: ["profile", "me"] });
      queryClient.setQueriesData<ProfileWithGym | null>({ queryKey: ["profile", "me"] }, (old) =>
        old ? { ...old, schedule_visibility: value } : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't update your visibility");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["profile"] })
  });
}

/**
 * Set (or clear) the home gym.
 *
 * Used by the map's gym sheet: tapping a pin used to offer only "Join gym
 * community" — which joined a surface that is still "coming soon" and was
 * reported as "Communities are still prompted from the map". Setting your home
 * gym is the action that actually belongs on a gym pin.
 */
export function useSetHomeGym() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (gymId: string | null) => {
      if (!userId) return;
      const { error } = await supabase.from("profiles").update({ home_gym_id: gymId }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => showToast("Couldn't set your home gym — try again")
  });
}
