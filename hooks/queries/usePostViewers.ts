import { useQuery } from "@tanstack/react-query";

import { mockViewersFree } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function usePostViewers(postId: string) {
  return useQuery({
    queryKey: ["post-viewers", postId],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockViewersFree;
      }
      const { data, error } = await supabase.functions.invoke("get-post-viewers", { body: { post_id: postId } });
      if (error) {
        throw error;
      }
      return mockViewersFree;
    }
  });
}
