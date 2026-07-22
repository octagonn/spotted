import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/** Canned rejection reasons (spec D). */
export const REJECTION_REASONS: { id: string; label: string }[] = [
  { id: "weight_not_visible", label: "Weight not visible" },
  { id: "no_lockout", label: "Rep didn't hit depth/lockout" },
  { id: "reshoot_plates", label: "Reshoot with plates in frame" },
  { id: "not_verifiable", label: "Can't verify this claim" }
];

export type PendingClaim = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  postId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  trophyId: string;
  claimedValue: number;
  createdAt: string;
};

/** Whether the signed-in user is a review admin (drives the admin entry point). */
export function useIsAdmin() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }
  });
}

/** File a lift trophy claim on a post (spec D). Publishes pending. */
export function useSubmitClaim() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (input: { postId: string; trophyId: string; value: number }) => {
      if (!userId) throw new Error("not_authenticated");
      const { error } = await supabase.from("trophy_claims").insert({
        user_id: userId,
        post_id: input.postId,
        trophy_id: input.trophyId,
        claimed_value: input.value
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-claims"] })
  });
}

/** The admin review queue — pending claims with video + claimant. */
export function usePendingClaims(enabled: boolean) {
  return useQuery({
    queryKey: ["pending-claims"],
    enabled: isSupabaseConfigured && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<PendingClaim[]> => {
      const { data, error } = await supabase
        .from("trophy_claims")
        .select("id, user_id, post_id, trophy_id, claimed_value, created_at, profile:user_id(username, display_name), post:post_id(media_url, thumbnail_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        user_id: string;
        post_id: string | null;
        trophy_id: string;
        claimed_value: number;
        created_at: string;
        profile: { username: string; display_name: string } | null;
        post: { media_url: string | null; thumbnail_url: string | null } | null;
      }[];
      return Promise.all(
        rows.map(async (row) => {
          const sign = async (path: string | null | undefined) => {
            if (!path) return null;
            if (path.startsWith("http")) return path;
            try {
              return await signedPostUrl(path);
            } catch {
              return null;
            }
          };
          return {
            id: row.id,
            userId: row.user_id,
            username: row.profile?.username ?? "unknown",
            displayName: row.profile?.display_name ?? "Unknown",
            postId: row.post_id,
            videoUrl: await sign(row.post?.media_url),
            thumbnailUrl: await sign(row.post?.thumbnail_url),
            trophyId: row.trophy_id,
            claimedValue: row.claimed_value,
            createdAt: row.created_at
          };
        })
      );
    }
  });
}

/** Approve/reject a claim (admin only — server re-checks). */
export function useReviewClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ claimId, approve, reasonId }: { claimId: string; approve: boolean; reasonId?: string }) => {
      const { error } = await supabase.rpc("review_trophy_claim", {
        p_claim: claimId,
        p_approve: approve,
        p_reason: reasonId ?? null
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-claims"] })
  });
}
