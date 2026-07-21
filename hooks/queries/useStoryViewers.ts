import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Profile } from "@/types/domain";

export type StoryViewer = Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> & {
  viewedAt: string;
};

/**
 * The "seen by" list for a story — only the story owner can read it (RLS). Most
 * recent viewer first. `enabled` is passed false for stories that aren't yours.
 */
export function useStoryViewers(storyId?: string, enabled = true) {
  return useQuery({
    queryKey: ["story-viewers", storyId],
    enabled: isSupabaseConfigured && Boolean(storyId) && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<StoryViewer[]> => {
      const { data, error } = await supabase
        .from("story_views")
        .select("viewed_at, profiles:viewer_id(id, username, display_name, avatar_url)")
        .eq("story_id", storyId as string)
        .order("viewed_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as {
        viewed_at: string;
        profiles: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
      }[])
        .filter((row) => row.profiles)
        .map((row) => ({ ...(row.profiles as StoryViewer), viewedAt: row.viewed_at }));
    }
  });
}
