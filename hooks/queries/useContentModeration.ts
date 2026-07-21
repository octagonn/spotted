import { useMutation, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** Delete one of your own posts (RLS enforces ownership). Removes storage too. */
export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, mediaPaths }: { postId: string; mediaPaths: string[] }) => {
      if (!isSupabaseConfigured) return;
      // Best-effort storage cleanup (paths, not signed URLs).
      const paths = mediaPaths.filter((p) => p && !p.startsWith("http"));
      if (paths.length) {
        await supabase.storage.from("posts").remove(paths).catch(() => {});
      }
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["signed-user-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["my-latest-post"] });
    }
  });
}

/** Delete one of your own stories. */
export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ storyId, mediaPath }: { storyId: string; mediaPath?: string | null }) => {
      if (!isSupabaseConfigured) return;
      if (mediaPath && !mediaPath.startsWith("http")) {
        await supabase.storage.from("posts").remove([mediaPath]).catch(() => {});
      }
      const { error } = await supabase.from("stories").delete().eq("id", storyId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["stories"] })
  });
}

export type ReportContentType = "post" | "story" | "user" | "comment";

export const REPORT_REASONS = [
  "Spam or scam",
  "Nudity or sexual content",
  "Harassment or bullying",
  "Hate speech or symbols",
  "Violence or dangerous acts",
  "Self-harm",
  "Something else"
] as const;

/** File a moderation report. Required for App Store UGC compliance. */
export function useReportContent() {
  const reporterId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (input: {
      contentType: ReportContentType;
      contentId: string;
      reportedUserId?: string | null;
      reason: string;
      note?: string | null;
    }) => {
      if (!isSupabaseConfigured || !reporterId) throw new Error("Not signed in");
      const { error } = await supabase.from("reports").insert({
        reporter_id: reporterId,
        content_type: input.contentType,
        content_id: input.contentId,
        reported_user_id: input.reportedUserId ?? null,
        reason: input.reason,
        note: input.note ?? null
      });
      if (error) throw error;
    }
  });
}
