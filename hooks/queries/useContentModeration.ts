import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import type { StoryGroup } from "@/hooks/queries/useStories";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import type { FeedPost } from "@/types/domain";

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
    // Optimistic: the post vanishes from the feed + profile grid instantly.
    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      await queryClient.cancelQueries({ queryKey: ["signed-user-posts"] });
      const prevFeed = queryClient.getQueriesData<InfiniteData<FeedPost[]>>({ queryKey: ["feed"] });
      const prevSigned = queryClient.getQueriesData<{ id: string }[]>({ queryKey: ["signed-user-posts"] });
      queryClient.setQueriesData<InfiniteData<FeedPost[]>>({ queryKey: ["feed"] }, (old) =>
        old ? { ...old, pages: old.pages.map((page) => page.filter((post) => post.id !== postId)) } : old
      );
      queryClient.setQueriesData<{ id: string }[]>({ queryKey: ["signed-user-posts"] }, (old) =>
        (old ?? []).filter((post) => post.id !== postId)
      );
      return { prevFeed, prevSigned };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prevFeed ?? []) queryClient.setQueryData(key, data);
      for (const [key, data] of ctx?.prevSigned ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't delete the post");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["signed-user-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["my-latest-post"] });
    }
  });
}

/** Delete one of your own stories. */
export function useDeleteStory() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ storyId, mediaPath }: { storyId: string; mediaPath?: string | null }) => {
      if (!isSupabaseConfigured) return;
      if (mediaPath && !mediaPath.startsWith("http")) {
        await supabase.storage.from("posts").remove([mediaPath]).catch(() => {});
      }
      const { error } = await supabase.from("stories").delete().eq("id", storyId);
      if (error) throw error;
    },
    // Optimistic: the story leaves the rail/viewer instantly (empty groups drop).
    onMutate: async ({ storyId }) => {
      await queryClient.cancelQueries({ queryKey: ["stories", userId] });
      const prev = queryClient.getQueryData<StoryGroup[]>(["stories", userId]);
      queryClient.setQueryData<StoryGroup[]>(["stories", userId], (old) =>
        (old ?? [])
          .map((group) => ({ ...group, stories: group.stories.filter((s) => s.id !== storyId) }))
          .filter((group) => group.stories.length > 0)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["stories", userId], ctx.prev);
      showToast("Couldn't delete the story");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["stories"] })
  });
}

export type ReportContentType = "post" | "story" | "user" | "comment" | "community";

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
      // Reporting a POST hides it immediately pending review (App Store: act on
      // reports fast). Best-effort — the report itself is already filed.
      if (input.contentType === "post") {
        try {
          await supabase.rpc("flag_post_from_report", { p_post: input.contentId });
        } catch {
          // best-effort — the report is already filed
        }
      }
    }
  });
}
