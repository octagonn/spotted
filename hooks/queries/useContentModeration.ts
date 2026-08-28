import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import type { StoryGroup } from "@/hooks/queries/useStories";
import { removePostObjects } from "@/lib/r2";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";
import { showToast, useUiStore } from "@/stores/ui";
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
        await removePostObjects(paths).catch(() => {});
      }
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      trackAnalyticsEvent("post_deleted");
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
    onSuccess: async () => {
      // Daily gate integrity: if that was the user's LAST post of the day,
      // the feed must re-lock. The server check re-derives on invalidation,
      // but the local optimistic "posted today" flag (set at publish time)
      // would keep the feed open — clear it when no post remains today.
      const userId = useAuthStore.getState().userId;
      if (!userId || !isSupabaseConfigured) return;
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", startOfDay.toISOString());
        if ((count ?? 0) === 0) {
          useUiStore.getState().clearPostedToday();
        }
      } catch {
        // Server check failed — leave the flag; the next my-latest-post
        // refetch still corrects cross-device state.
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["signed-user-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["my-latest-post"] });
      void queryClient.invalidateQueries({ queryKey: ["today-daily-post"] });
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
        await removePostObjects([mediaPath]).catch(() => {});
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

export type ReportContentType = "post" | "story" | "user" | "comment" | "community" | "conversation";

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
      trackAnalyticsEvent("content_reported", { content_type: input.contentType, reason: input.reason });
      // Reporting a POST marks it 'reported' — it STAYS visible to everyone
      // and enters the admin review queue; only the reviewer's decision (or
      // the NSFW auto-flag) removes it. Best-effort — the report is filed.
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
