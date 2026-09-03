import { useQuery } from "@tanstack/react-query";

import { mockViewers } from "@/lib/mockData";
import { isDemoMode, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ViewerPreview } from "@/types/domain";

export function usePostViewers(postId: string) {
  return useQuery({
    queryKey: ["post-viewers", postId],
    queryFn: async (): Promise<ViewerPreview> => {
      if (isDemoMode) {
        return mockViewers;
      }
      const { data, error } = await supabase.functions.invoke<ViewerPreview>("get-post-viewers", {
        body: { post_id: postId }
      });
      if (error) {
        throw error;
      }
      // An empty function response is "nobody yet" — never fixture people.
      return data ?? { total_count: 0, viewers: [] };
    },
    enabled: Boolean(postId) && (isDemoMode || isSupabaseConfigured)
  });
}
