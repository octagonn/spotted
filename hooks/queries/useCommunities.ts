import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
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
  /** gyms.chain / gyms.institution for gym communities — drive the shared logo. */
  gymChain: string | null;
  gymInstitution: string | null;
  createdBy: string | null;
  photoUrl: string | null;
  description: string | null;
  privacy: "public" | "private";
  location: string | null;
  memberCount: number;
  postCount: number;
  /** When the community launched — drives tenure badges. */
  createdAt: string | null;
  /** Present on the signed-in user's own memberships (useMyCommunities). */
  joinedAt?: string | null;
  muted?: boolean;
};

export type CommunityMessage = {
  id: string;
  community_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  /** "user" | "system" — system rows are announcements (Diamond trophies). */
  kind?: string;
  sender: { username: string; display_name: string; avatar_url: string | null } | null;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  media_url: string | null;
  created_at: string;
  username: string;
};

const COMMUNITY_SELECT =
  "id, name, type, gym_id, created_by, created_at, photo_url, description, privacy, location, gym:gym_id(chain, institution), members:community_members(count), posts:post_communities(count)";

type CommunityRow = {
  id: string;
  name: string;
  type: string;
  gym_id: string | null;
  created_by: string | null;
  created_at?: string | null;
  photo_url: string | null;
  description: string | null;
  privacy: string | null;
  location: string | null;
  gym?: { chain: string | null; institution: string | null } | null;
  members?: { count: number }[] | null;
  posts?: { count: number }[] | null;
};

function normalizeCommunity(row: CommunityRow): CommunitySummary {
  return {
    id: row.id,
    name: row.name,
    type: (COMMUNITY_TYPES.includes(row.type as CommunityType) ? row.type : "custom") as CommunityType,
    gym_id: row.gym_id,
    gymChain: row.gym?.chain ?? null,
    gymInstitution: row.gym?.institution ?? null,
    createdBy: row.created_by,
    photoUrl: row.photo_url,
    description: row.description,
    privacy: row.privacy === "private" ? "private" : "public",
    location: row.location,
    memberCount: row.members?.[0]?.count ?? 0,
    postCount: row.posts?.[0]?.count ?? 0,
    createdAt: row.created_at ?? null
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
        .select("community_id, joined_at, muted")
        .eq("user_id", userId as string);
      if (memberships.error) throw memberships.error;
      const rows = (memberships.data ?? []) as { community_id: string; joined_at: string; muted: boolean }[];
      const ids = rows.map((row) => row.community_id);
      if (ids.length === 0) return [];
      const byId = new Map(rows.map((row) => [row.community_id, row]));
      const { data, error } = await supabase
        .from("communities")
        .select(COMMUNITY_SELECT)
        .in("id", ids)
        .order("name");
      if (error) throw error;
      return ((data ?? []) as unknown as CommunityRow[]).map((row) => {
        const membership = byId.get(row.id);
        return { ...normalizeCommunity(row), joinedAt: membership?.joined_at ?? null, muted: membership?.muted ?? false };
      });
    }
  });
}

/**
 * What the signed-in user may do in a community — computed server-side by
 * community_permissions() from their role (the owner always has everything).
 * RLS enforces the same flags; these only gate UI.
 */
export type CommunityPermissions = {
  member: boolean;
  owner: boolean;
  admin: boolean;
  view_chat: boolean;
  send_messages: boolean;
  view_posts: boolean;
  post: boolean;
  invite: boolean;
  manage_members: boolean;
  manage_roles: boolean;
  role_id: string | null;
  role_name: string | null;
};

export const NO_PERMISSIONS: CommunityPermissions = {
  member: false,
  owner: false,
  admin: false,
  view_chat: false,
  send_messages: false,
  view_posts: false,
  post: false,
  invite: false,
  manage_members: false,
  manage_roles: false,
  role_id: null,
  role_name: null
};

function normalizePermissions(raw: unknown): CommunityPermissions {
  if (!raw || typeof raw !== "object") return NO_PERMISSIONS;
  const r = raw as Record<string, unknown>;
  const flag = (k: keyof CommunityPermissions) => r[k] === true;
  return {
    member: flag("member"),
    owner: flag("owner"),
    admin: flag("admin"),
    view_chat: flag("view_chat"),
    send_messages: flag("send_messages"),
    view_posts: flag("view_posts"),
    post: flag("post"),
    invite: flag("invite"),
    manage_members: flag("manage_members"),
    manage_roles: flag("manage_roles"),
    role_id: typeof r.role_id === "string" ? r.role_id : null,
    role_name: typeof r.role_name === "string" ? r.role_name : null
  };
}

export type CommunityDetail = CommunitySummary & {
  isMember: boolean;
  /** Full control (owner or an admin role). */
  isAdmin: boolean;
  /** Any management surface at all — shows the settings gear's admin sections. */
  canManage: boolean;
  perms: CommunityPermissions;
  muted: boolean;
};

export function useCommunity(communityId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["community", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId),
    queryFn: async (): Promise<CommunityDetail | null> => {
      const [communityResult, membershipResult, permsResult] = await Promise.all([
        supabase.from("communities").select(COMMUNITY_SELECT).eq("id", communityId as string).maybeSingle(),
        supabase
          .from("community_members")
          .select("user_id, role, joined_at, muted")
          .eq("community_id", communityId as string)
          .eq("user_id", userId ?? "")
          .maybeSingle(),
        userId
          ? supabase.rpc("community_permissions", { p_community: communityId as string, p_user: userId })
          : Promise.resolve({ data: null, error: null })
      ]);
      if (communityResult.error) throw communityResult.error;
      if (!communityResult.data) return null;
      const summary = normalizeCommunity(communityResult.data as unknown as CommunityRow);
      const perms = normalizePermissions(permsResult.error ? null : permsResult.data);
      return {
        ...summary,
        joinedAt: membershipResult.data?.joined_at ?? null,
        muted: membershipResult.data?.muted ?? false,
        isMember: Boolean(membershipResult.data),
        isAdmin: perms.admin,
        canManage: perms.admin || perms.manage_members || perms.manage_roles,
        perms
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
        .select("id, community_id, sender_id, content, sent_at, kind, sender:sender_id(username, display_name, avatar_url)")
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
    // Optimistic: the message lands in the thread instantly.
    onMutate: async (content) => {
      const trimmed = content.trim();
      if (!communityId || !userId || !trimmed) return { prev: undefined };
      await queryClient.cancelQueries({ queryKey: ["community-messages", communityId] });
      const prev = queryClient.getQueryData<CommunityMessage[]>(["community-messages", communityId]);
      const myProfile = queryClient
        .getQueriesData<{ username?: string | null; display_name?: string | null; avatar_url?: string | null } | null>({
          queryKey: ["profile", "me"]
        })
        .map(([, data]) => data)
        .find(Boolean);
      const temp: CommunityMessage = {
        id: `temp-${Date.now()}`,
        community_id: communityId,
        sender_id: userId,
        content: trimmed.slice(0, 1000),
        sent_at: new Date().toISOString(),
        sender: {
          username: myProfile?.username ?? "you",
          display_name: myProfile?.display_name ?? "You",
          avatar_url: myProfile?.avatar_url ?? null
        }
      };
      queryClient.setQueryData<CommunityMessage[]>(["community-messages", communityId], (old) => [...(old ?? []), temp]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && communityId) queryClient.setQueryData(["community-messages", communityId], ctx.prev);
      showToast("Couldn't send the message");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["community-messages", communityId] })
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

export type CommunityRole = {
  id: string;
  community_id: string;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
  is_admin: boolean;
  can_view_chat: boolean;
  can_send_messages: boolean;
  can_view_posts: boolean;
  can_post: boolean;
  can_invite: boolean;
  can_manage_members: boolean;
  can_manage_roles: boolean;
};

export type CommunityMember = {
  user_id: string;
  role: string;
  role_id: string | null;
  joined_at: string;
  profile: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
  /** The member's role row (null = legacy row, falls back to the default role). */
  roleInfo: Pick<CommunityRole, "id" | "name" | "color" | "is_admin" | "position"> | null;
};

/** Everyone in a community — admins first, then longest-standing members. */
export function useCommunityMembers(communityId?: string, enabled = true) {
  return useQuery({
    queryKey: ["community-members", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId) && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<CommunityMember[]> => {
      const { data, error } = await supabase
        .from("community_members")
        .select(
          "user_id, role, role_id, joined_at, profile:user_id(id, username, display_name, avatar_url), roleInfo:community_roles!community_members_role_id_fkey(id, name, color, is_admin, position)"
        )
        .eq("community_id", communityId as string)
        .order("joined_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as unknown as CommunityMember[];
      // Admins first, then by role position, then tenure.
      const rank = (m: CommunityMember) =>
        m.roleInfo ? (m.roleInfo.is_admin ? -1 : m.roleInfo.position) : m.role === "admin" ? -1 : 1_000;
      return rows.sort((a, b) => rank(a) - rank(b));
    }
  });
}

/** Pending private-community join requests for the signed-in user, with names. */
export function useMyPendingJoinRequests() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["my-join-requests", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<{ communityId: string; name: string; requestedAt: string }[]> => {
      const { data, error } = await supabase
        .from("community_join_requests")
        .select("community_id, requested_at, community:community_id(name)")
        .eq("user_id", userId as string)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as { community_id: string; requested_at: string; community: { name: string } | null }[]).map(
        (row) => ({ communityId: row.community_id, name: row.community?.name ?? "Community", requestedAt: row.requested_at })
      );
    }
  });
}

function invalidateCommunityCaches(queryClient: ReturnType<typeof useQueryClient>, communityId?: string) {
  void queryClient.invalidateQueries({ queryKey: ["my-communities"] });
  // Joining/leaving changes what Discover should list and which crews have
  // activity rows — refresh both so a just-joined community leaves Discover
  // immediately.
  void queryClient.invalidateQueries({ queryKey: ["discover-communities"] });
  void queryClient.invalidateQueries({ queryKey: ["crew-activity"] });
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
    // Optimistic: the community id isn't known yet (the RPC may create it), so
    // flip membership on any cached community detail for this gym.
    onMutate: async (gymId) => {
      await queryClient.cancelQueries({ queryKey: ["community"] });
      await queryClient.cancelQueries({ queryKey: ["my-communities"] });
      const prevCommunities = queryClient.getQueriesData<CommunityDetail | null>({ queryKey: ["community"] });
      const prevMine = queryClient.getQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] });
      for (const [key, detail] of prevCommunities) {
        if (detail && detail.gym_id === gymId && !detail.isMember) {
          queryClient.setQueryData(key, { ...detail, isMember: true, memberCount: detail.memberCount + 1 });
          queryClient.setQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] }, (old) =>
            old && !old.some((c) => c.id === detail.id) ? [...old, detail] : old
          );
        }
      }
      return { prevCommunities, prevMine };
    },
    onError: (_err, _gymId, ctx) => {
      for (const [key, data] of ctx?.prevCommunities ?? []) queryClient.setQueryData(key, data);
      for (const [key, data] of ctx?.prevMine ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't join the gym community");
    },
    onSettled: (communityId) => invalidateCommunityCaches(queryClient, communityId ?? undefined)
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
    // Optimistic: the Join button flips + the community shows in "my" lists instantly.
    onMutate: async (communityId) => {
      await queryClient.cancelQueries({ queryKey: ["community", communityId] });
      await queryClient.cancelQueries({ queryKey: ["my-communities"] });
      const prevCommunity = queryClient.getQueryData<CommunityDetail | null>(["community", communityId]);
      const prevMine = queryClient.getQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] });
      queryClient.setQueryData<CommunityDetail | null>(["community", communityId], (old) =>
        old ? { ...old, isMember: true, memberCount: old.memberCount + 1 } : old
      );
      if (prevCommunity) {
        queryClient.setQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] }, (old) =>
          old && !old.some((c) => c.id === communityId) ? [...old, prevCommunity] : old
        );
      }
      return { prevCommunity, prevMine };
    },
    onError: (_err, communityId, ctx) => {
      if (ctx?.prevCommunity !== undefined) queryClient.setQueryData(["community", communityId], ctx.prevCommunity);
      for (const [key, data] of ctx?.prevMine ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't join the community");
    },
    onSettled: (_data, _err, communityId) => invalidateCommunityCaches(queryClient, communityId)
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
    // Optimistic: membership flips off + the community leaves "my" lists instantly.
    onMutate: async (communityId) => {
      await queryClient.cancelQueries({ queryKey: ["community", communityId] });
      await queryClient.cancelQueries({ queryKey: ["my-communities"] });
      const prevCommunity = queryClient.getQueryData<CommunityDetail | null>(["community", communityId]);
      const prevMine = queryClient.getQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] });
      queryClient.setQueryData<CommunityDetail | null>(["community", communityId], (old) =>
        old ? { ...old, isMember: false, memberCount: Math.max(0, old.memberCount - 1) } : old
      );
      queryClient.setQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] }, (old) =>
        (old ?? []).filter((c) => c.id !== communityId)
      );
      return { prevCommunity, prevMine };
    },
    onError: (_err, communityId, ctx) => {
      if (ctx?.prevCommunity !== undefined) queryClient.setQueryData(["community", communityId], ctx.prevCommunity);
      for (const [key, data] of ctx?.prevMine ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't leave the community");
    },
    onSettled: (_data, _err, communityId) => invalidateCommunityCaches(queryClient, communityId)
  });
}

/** Mute-per-group: silences this community's pushes (nudges, invites) for you only. */
export function useMuteCommunity() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ communityId, muted }: { communityId: string; muted: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("community_members")
        .update({ muted })
        .eq("community_id", communityId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: async ({ communityId, muted }) => {
      await queryClient.cancelQueries({ queryKey: ["community", communityId] });
      const prev = queryClient.getQueryData<CommunityDetail | null>(["community", communityId]);
      queryClient.setQueryData<CommunityDetail | null>(["community", communityId], (old) => (old ? { ...old, muted } : old));
      queryClient.setQueriesData<CommunitySummary[]>({ queryKey: ["my-communities"] }, (old) =>
        (old ?? []).map((c) => (c.id === communityId ? { ...c, muted } : c))
      );
      return { prev };
    },
    onError: (_err, { communityId }, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["community", communityId], ctx.prev);
      showToast("Couldn't update mute");
    },
    onSettled: (_d, _e, { communityId }) => {
      void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
      void queryClient.invalidateQueries({ queryKey: ["my-communities"] });
    }
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
/** Creator-only hard delete (6b). Server RPC verifies ownership; every
 *  dependent table cascades, so members just see it vanish from their lists. */
export function useDeleteCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId: string) => {
      const { error } = await supabase.rpc("delete_community", { p_community: communityId });
      if (error) throw error;
    },
    onSuccess: (_data, communityId) => invalidateCommunityCaches(queryClient, communityId)
  });
}

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
    // Optimistic: the button flips to "Requested" instantly.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["community-my-request", communityId] });
      const prev = queryClient.getQueriesData<boolean>({ queryKey: ["community-my-request", communityId] });
      queryClient.setQueriesData<boolean>({ queryKey: ["community-my-request", communityId] }, true);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't send the join request");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["community-my-request", communityId] })
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
    // Optimistic: the invite banner/row disappears the instant it's answered.
    onMutate: async ({ communityId }) => {
      await queryClient.cancelQueries({ queryKey: ["community-invite", communityId] });
      const prev = queryClient.getQueriesData<boolean>({ queryKey: ["community-invite", communityId] });
      queryClient.setQueriesData<boolean>({ queryKey: ["community-invite", communityId] }, false);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.prev ?? []) queryClient.setQueryData(key, data);
      showToast("Couldn't respond to the invite");
    },
    onSettled: (_data, _err, { communityId }) => {
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
    // Optimistic: the request row leaves the admin list instantly.
    onMutate: async ({ userId: requesterId }) => {
      await queryClient.cancelQueries({ queryKey: ["community-requests", communityId] });
      const prev = queryClient.getQueryData<JoinRequester[]>(["community-requests", communityId]);
      queryClient.setQueryData<JoinRequester[]>(["community-requests", communityId], (old) =>
        (old ?? []).filter((request) => request.user_id !== requesterId)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && communityId) queryClient.setQueryData(["community-requests", communityId], ctx.prev);
      showToast("Couldn't respond to the request");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["community-requests", communityId] });
      invalidateCommunityCaches(queryClient, communityId);
    }
  });
}

/* ------------------------- invite codes (spec 19) ------------------------- */

/** The community's invite code — members only (definer fn returns null otherwise). */
export function useCommunityInviteCode(communityId?: string, enabled = true) {
  return useQuery({
    queryKey: ["community-code", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("community_invite_code", {
        cid: communityId as string
      });
      if (error) throw error;
      return data ?? null;
    }
  });
}

/** Admin: regenerate the invite code (invalidates the old one). */
export function useRegenerateInviteCode(communityId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("regenerate_community_invite_code", {
        cid: communityId as string
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["community-code", communityId] })
  });
}

/** Join any community (incl. private — bypasses approval) with a valid code. */
export function useJoinByCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<string | null> => {
      const { data, error } = await supabase.rpc("join_community_by_code", { code });
      if (error) throw error;
      return data ?? null;
    },
    onSuccess: (communityId) => {
      if (communityId) invalidateCommunityCaches(queryClient, communityId);
    }
  });
}

/* --------------------- notification prefs (spec 18) ----------------------- */

/** Whether the user muted this community's notifications. */
export function useCommunityMuted(communityId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["community-muted", communityId, userId],
    enabled: isSupabaseConfigured && Boolean(communityId) && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("community_notification_prefs")
        .select("muted")
        .eq("community_id", communityId as string)
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data?.muted ?? false;
    }
  });
}

export function useSetCommunityMuted(communityId?: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (muted: boolean) => {
      if (!communityId || !userId) return;
      const { error } = await supabase
        .from("community_notification_prefs")
        .upsert({ community_id: communityId, user_id: userId, muted, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onMutate: async (muted) => {
      const key = ["community-muted", communityId, userId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, muted);
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ["community-muted", communityId, userId] })
  });
}

/* ------------------------- discovery (spec 20) ---------------------------- */

/**
 * Public communities to join, excluding ones you're already in. Ranked: your
 * home gym's communities first, then located ones, then by member count.
 * Private communities never appear (invite code only).
 */
export function useDiscoverCommunities(search: string, homeGymId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  const q = search.trim();
  return useQuery({
    queryKey: ["discover-communities", userId, q, homeGymId ?? null],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    // Typing re-keys the query; without this the list emptied on every
    // keystroke and the hub's sections collapsed under the search field.
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<CommunitySummary[]> => {
      const memberships = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", userId as string);
      if (memberships.error) throw memberships.error;
      const mine = new Set((memberships.data ?? []).map((row) => row.community_id));
      let rows: CommunityRow[];
      if (q) {
        // Typo-tolerant trigram search over name + description (pg_trgm RPC),
        // then hydrate member/post counts for the matched ids.
        const fuzzy = await supabase.rpc("search_communities_fuzzy", { q, max_rows: 60 });
        if (fuzzy.error) throw fuzzy.error;
        const ids = ((fuzzy.data ?? []) as { id: string }[]).map((row) => row.id);
        if (ids.length === 0) return [];
        const { data, error } = await supabase.from("communities").select(COMMUNITY_SELECT).in("id", ids);
        if (error) throw error;
        const order = new Map(ids.map((id, i) => [id, i]));
        rows = ((data ?? []) as unknown as CommunityRow[]).sort(
          (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
        );
      } else {
        const { data, error } = await supabase
          .from("communities")
          .select(COMMUNITY_SELECT)
          .eq("privacy", "public")
          .limit(60);
        if (error) throw error;
        rows = (data ?? []) as unknown as CommunityRow[];
      }
      const results = rows.filter((row) => !mine.has(row.id)).map(normalizeCommunity);
      // With a query, keep similarity order from the RPC; otherwise rank by
      // home-gym affinity → located → member count (existing behavior).
      if (q) return results;
      const rank = (c: CommunitySummary) =>
        (homeGymId && c.gym_id === homeGymId ? 2 : 0) + (c.location ? 1 : 0);
      return results.sort((a, b) => rank(b) - rank(a) || b.memberCount - a.memberCount);
    }
  });
}

// ---------------------------------------------------------------- roles

/** All roles of a community, admin first then by position. */
export function useCommunityRoles(communityId?: string, enabled = true) {
  return useQuery({
    queryKey: ["community-roles", communityId],
    enabled: isSupabaseConfigured && Boolean(communityId) && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<CommunityRole[]> => {
      const { data, error } = await supabase
        .from("community_roles")
        .select(
          "id, community_id, name, color, position, is_default, is_admin, can_view_chat, can_send_messages, can_view_posts, can_post, can_invite, can_manage_members, can_manage_roles"
        )
        .eq("community_id", communityId as string)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommunityRole[];
    }
  });
}

export type RoleInput = Partial<
  Pick<
    CommunityRole,
    | "name"
    | "color"
    | "position"
    | "is_default"
    | "is_admin"
    | "can_view_chat"
    | "can_send_messages"
    | "can_view_posts"
    | "can_post"
    | "can_invite"
    | "can_manage_members"
    | "can_manage_roles"
  >
>;

function useInvalidateRoles(communityId?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["community-roles", communityId] });
    void queryClient.invalidateQueries({ queryKey: ["community-members", communityId] });
    void queryClient.invalidateQueries({ queryKey: ["community", communityId] });
  };
}

export function useCreateCommunityRole(communityId?: string) {
  const invalidate = useInvalidateRoles(communityId);
  return useMutation({
    mutationFn: async (input: RoleInput & { name: string }) => {
      if (!communityId) throw new Error("No community");
      const { data, error } = await supabase
        .from("community_roles")
        .insert({ ...input, community_id: communityId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate
  });
}

export function useUpdateCommunityRole(communityId?: string) {
  const invalidate = useInvalidateRoles(communityId);
  return useMutation({
    mutationFn: async ({ roleId, ...patch }: RoleInput & { roleId: string }) => {
      const { error } = await supabase.from("community_roles").update(patch).eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: invalidate
  });
}

export function useDeleteCommunityRole(communityId?: string) {
  const invalidate = useInvalidateRoles(communityId);
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("community_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: invalidate
  });
}

/** Assign a role to a member (server checks manage_members / admin rules). */
export function useSetMemberRole(communityId?: string) {
  const invalidate = useInvalidateRoles(communityId);
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      if (!communityId) throw new Error("No community");
      const { error } = await supabase.rpc("set_community_member_role", {
        p_community: communityId,
        p_user: userId,
        p_role: roleId
      });
      if (error) throw error;
    },
    onSuccess: invalidate
  });
}

/** Kick a member (server checks manage_members; admins need admin). */
export function useRemoveCommunityMember(communityId?: string) {
  const invalidate = useInvalidateRoles(communityId);
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!communityId) throw new Error("No community");
      const { error } = await supabase.rpc("remove_community_member", { p_community: communityId, p_user: userId });
      if (error) throw error;
    },
    onSuccess: invalidate
  });
}

/** Human copy for the RPC / trigger error codes above. */
export function roleErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (msg.includes("owner_role_locked")) return "The owner's role can't be changed.";
  if (msg.includes("cannot_change_own_role")) return "You can't change your own role.";
  if (msg.includes("admin_required")) return "Only admins can change admin roles.";
  if (msg.includes("last_admin_role")) return "A community needs at least one admin role.";
  if (msg.includes("default_role_locked")) return "Make another role the default first.";
  if (msg.includes("cannot_remove_owner")) return "The owner can't be removed.";
  if (msg.includes("forbidden") || msg.includes("row-level security")) return "You don't have permission to do that.";
  return "Something went wrong — try again.";
}
