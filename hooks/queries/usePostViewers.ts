import { useQuery } from "@tanstack/react-query";

import { mockViewers } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ViewerPreview } from "@/types/domain";

export function usePostViewers(postId: string) {
  return useQuery({
    queryKey: ["post-viewers", postId],
    queryFn: async (): Promise<ViewerPreview> => {
      if (!isSupabaseConfigured) {
        return mockViewers;
      }
      const { data, error } = await supabase.functions.invoke<ViewerPreview>("get-post-viewers", {
        body: { post_id: postId }
      });
      if (error) {
        throw error;
      }
      if (!data) {
        return mockViewers;
      }
      return data;
    },
    enabled: Boolean(postId)
  });
}
