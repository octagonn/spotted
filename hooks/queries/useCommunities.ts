import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Database } from "@/types/database";
import type { Profile } from "@/types/domain";

type CommunityUpdate = Database["public"]["Tables"]["communities"]["Update"];

export type CommunityType =
  | "gym"
  | "crew"
  | "friends"
  | "college"
  | "creator"
  | "brand"
  | "fun"
  | "custom";

const COMMUNITY_TYPES: CommunityType[] = ["gym", "crew", "friends", "college", "creator", "brand", "fun", "custom"];

export type CommunitySummary = {
  id: string;
  name: string;
  type: CommunityType;
  gym_id: string | null;
  createdBy: string | null;
  photoUrl: string | null;
  description: string | null;
  privacy: "public" | "private";
  location: string | null;
  memberCount: number;
  postCount: number;
};

export type CommunityMessage = {
  id: string;
  community_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  sender: { username: string; display_name: string } | null;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  media_url: string | null;
  created_at: string;
  username: string;
};

const COMMUNITY_SELECT =
  "id, name, type, gym_id, created_by, photo_url, description, privacy, location, members:community_members(count), posts:post_communities(count)";

type CommunityRow = {
  id: string;
  name: string;
  type: string;
  gym_id: string | null;
  created_by: string | null;
  photo_url: string | null;
  description: string | null;
  privacy: string | null;
  location: string | null;
  members?: { count: number }[] | null;
  posts?: { count: number }[] | null;
};

function normalizeCommunity(row: CommunityRow): CommunitySummary {
  return {
    id: row.id,
    name: row.name,
    type: (COMMUNITY_TYPES.includes(row.type as CommunityType) ? row.type : "custom") as CommunityType,
    gym_id: row.gym_id,
    createdBy: row.created_by,
    photoUrl: row.photo_url,
    description: row.description,
    privacy: row.privacy === "private" ? "private" : "public",
    location: row.location,
    memberCount: row.members?.[0]?.count ?? 0,
    postCount: row.posts?.[0]?.count ?? 0
  };
}

/** Communities the signed-in user belongs to. */
export function useMyCommunities() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["my-communities", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<CommunitySummary[]> => {
      const memberships = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", userId as string);
      if (memberships.error) throw memberships.error;
      const ids = (memberships.data ?? []).map((row) => row.community_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("communities")
        .select(COMMUNITY_SELECT)
        .in("id", ids)
        .order("name");
      if (error) throw error;
      return ((data ?? []) as unknown as CommunityRow[]).map(normalizeCommunity);
    }
  });
}

export type CommunityDetail = CommunitySummary & { isMember: boolean; isAdmin: boolean };

export function useCommunity(communityId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["community", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId),
    queryFn: async (): Promise<CommunityDetail | null> => {
      const [communityResult, membershipResult] = await Promise.all([
        supabase.from("communities").select(COMMUNITY_SELECT).eq("id", communityId as string).maybeSingle(),
        supabase
          .from("community_members")
          .select("user_id")
          .eq("community_id", communityId as string)
          .eq("user_id", userId ?? "")
          .maybeSingle()
      ]);
      if (communityResult.error) throw communityResult.error;
      if (!communityResult.data) return null;
      const summary = normalizeCommunity(communityResult.data as unknown as CommunityRow);
      return {
        ...summary,
        isMember: Boolean(membershipResult.data),
        isAdmin: Boolean(userId) && summary.createdBy === userId
      };
    }
  });
}

export function useCommunityMessages(communityId?: string, enabled = true) {
  return useQuery({
    queryKey: ["community-messages", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId) && enabled,
    queryFn: async (): Promise<CommunityMessage[]> => {
      const { data, error } = await supabase
        .from("community_messages")
        .select("id, community_id, sender_id, content, sent_at, sender:sender_id(username, display_name)")
        .eq("community_id", communityId as string)
        .order("sent_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as CommunityMessage[];
    }
  });
}

export function useSendCommunityMessage(communityId?: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (content: string) => {
      const trimmed = content.trim();
      if (!communityId || !userId || !trimmed) return;
      const { error } = await supabase
        .from("community_messages")
        .insert({ community_id: communityId, sender_id: userId, content: trimmed.slice(0, 1000) });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["community-messages", communityId] })
  });
}

export function useCommunityMessagesRealtime(communityId?: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isSupabaseConfigured || !communityId) return;
    const channel = supabase
      .channel(`community-messages:${communityId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${communityId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["community-messages", communityId] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId, queryClient]);
}

export function useCommunityPosts(communityId?: string, enabled = true) {
  return useQuery({
    queryKey: ["community-posts", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId) && enabled,
    queryFn: async (): Promise<CommunityPost[]> => {
      const { data, error } = await supabase
        .from("post_communities")
        .select("post:posts(id, user_id, media_url, created_at, profiles:user_id(username))")
        .eq("community_id", communityId as string);
      if (error) throw error;
      const rows: CommunityPost[] = [];
      for (const item of (data ?? []) as unknown as {
        post: { id: string; user_id: string; media_url: string; created_at: string; profiles: { username: string } | null } | null;
      }[]) {
        if (!item.post) continue;
        let media = item.post.media_url;
        if (media && !media.startsWith("http")) {
          try {
            media = await signedPostUrl(media);
          } catch {
            media = null as unknown as string;
          }
        }
        rows.push({
          id: item.post.id,
          user_id: item.post.user_id,
          media_url: media,
          created_at: item.post.created_at,
          username: item.post.profiles?.username ?? "unknown"
        });
      }
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  });
}

function invalidateCommunityCaches(queryClient: ReturnType<typeof useQueryClient>, communityId?: string) {
  void queryClient.invalidateQueries({ queryKey: ["my-communities"] });
  if (communityId) {
    void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
  }
}

/** Join (creating if needed) the community for a real gym. Returns community id. */
export function useJoinGymCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gymId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("join_gym_community", { p_gym_id: gymId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (communityId) => invalidateCommunityCaches(queryClient, communityId)
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (communityId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("community_members")
        .upsert({ community_id: communityId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: (_data, communityId) => invalidateCommunityCaches(queryClient, communityId)
  });
}

export function useLeaveCommunity() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (communityId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_data, communityId) => invalidateCommunityCaches(queryClient, communityId)
  });
}

export type CreateCommunityInput = {
  name: string;
  type: CommunityType;
  description?: string | null;
  photoUrl?: string | null;
  privacy?: "public" | "private";
  location?: string | null;
};

/** Create a community (non-gym) and auto-join it as the admin. */
export function useCreateCommunity() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (input: CreateCommunityInput): Promise<string> => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("communities")
        .insert({
          name: input.name.trim().slice(0, 126),
          type: input.type,
          description: input.description?.trim().slice(0, 1251) || null,
          photo_url: input.photoUrl ?? null,
          privacy: input.privacy ?? "public",
          location: input.location?.trim() || null,
          created_by: userId
        })
        .select("id")
        .single();
      if (error) throw error;
      const membership = await supabase
        .from("community_members")
        .insert({ community_id: data.id, user_id: userId });
      if (membership.error) throw membership.error;
      return data.id;
    },
    onSuccess: (communityId) => invalidateCommunityCaches(queryClient, communityId)
  });
}

/** Admin edits community settings (all wizard fields). */
export function useUpdateCommunity(communityId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      name?: string;
      description?: string | null;
      photoUrl?: string | null;
      privacy?: "public" | "private";
      location?: string | null;
    }) => {
      if (!communityId) throw new Error("No community");
      const update: CommunityUpdate = {};
      if (patch.name !== undefined) update.name = patch.name.trim().slice(0, 126);
      if (patch.description !== undefined) update.description = patch.description?.trim().slice(0, 1251) || null;
      if (patch.photoUrl !== undefined) update.photo_url = patch.photoUrl;
      if (patch.privacy !== undefined) update.privacy = patch.privacy;
      if (patch.location !== undefined) update.location = patch.location?.trim() || null;
      const { error } = await supabase.from("communities").update(update).eq("id", communityId);
      if (error) throw error;
    },
    onSuccess: () => invalidateCommunityCaches(queryClient, communityId)
  });
}

// ─── Private-community join requests ─────────────────────────────────────────

export type JoinRequester = { user_id: string; requested_at: string; profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null };

/** Whether the current user has a pending request for this community. */
export function useMyJoinRequest(communityId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["community-my-request", communityId, userId],
    enabled: isSupabaseConfigured && Boolean(communityId) && Boolean(userId),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("community_join_requests")
        .select("user_id")
        .eq("community_id", communityId as string)
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }
  });
}

/** Admin: pending join requests for a community. */
export function useCommunityJoinRequests(communityId?: string, enabled = true) {
  return useQuery({
    queryKey: ["community-requests", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId) && enabled,
    queryFn: async (): Promise<JoinRequester[]> => {
      const { data, error } = await supabase
        .from("community_join_requests")
        .select("user_id, requested_at, profile:user_id(id, username, display_name, avatar_url)")
        .eq("community_id", communityId as string)
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as JoinRequester[];
    }
  });
}

export function useRequestToJoin(communityId?: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async () => {
      if (!communityId || !userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("community_join_requests")
        .upsert({ community_id: communityId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["community-my-request", communityId] })
  });
}

// ─── Community invites ───────────────────────────────────────────────────────

/** Invite a friend to a community you're in. Duplicate invites are a no-op. */
export function useInviteToCommunity(communityId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (inviteeId: string) => {
      if (!communityId || !userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("community_invites")
        .insert({ community_id: communityId, inviter_id: userId, invitee_id: inviteeId });
      if (error && error.code !== "23505") throw error;
    }
  });
}

/** Whether the current user has a pending invite to this community. */
export function useMyCommunityInvite(communityId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["community-invite", communityId, userId],
    enabled: isSupabaseConfigured && Boolean(communityId) && Boolean(userId),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("community_invites")
        .select("community_id")
        .eq("community_id", communityId as string)
        .eq("invitee_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }
  });
}

/** Accept/decline a community invite (accept joins even private communities). */
export function useRespondCommunityInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ communityId, accept }: { communityId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_community_invite", {
        p_community_id: communityId,
        p_accept: accept
      });
      if (error) throw error;
    },
    onSuccess: (_data, { communityId }) => {
      invalidateCommunityCaches(queryClient, communityId);
      void queryClient.invalidateQueries({ queryKey: ["community-invite", communityId] });
    }
  });
}

export function useRespondJoinRequest(communityId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, accept }: { userId: string; accept: boolean }) => {
      if (!communityId) throw new Error("No community");
      const { error } = await supabase.rpc("respond_join_request", {
        p_community_id: communityId,
        p_user_id: userId,
        p_accept: accept
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["community-requests", communityId] });
      invalidateCommunityCaches(queryClient, communityId);
    }
  });
}
