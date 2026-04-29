import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mockFeed } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useFeed() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockFeed;
      }
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles:user_id(id, username, display_name, avatar_url, avatar_blurred_url), gyms:gym_id(id, name, latitude, longitude)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      return mockFeed.map((post) => post);
    }
  });
}

export function useMarkPostViewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;
      if (!userId) {
        return;
      }
      const { error } = await supabase.from("post_views").upsert({ post_id: postId, viewer_id: userId });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    }
  });
}
