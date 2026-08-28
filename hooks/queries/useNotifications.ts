import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { useIncomingRequests } from "@/hooks/queries/useFriends";
import { isSupabaseConfigured, signedPostUrls, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";

export type AppNotification = {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string;
  actorUsername: string | null;
  actorAvatar: string | null;
  read: boolean;
  createdAt: string;
  payload: Record<string, unknown> | null;
  /** Signed preview of the related post (reaction/tag/etc.) — right-side thumb. */
  postThumbUrl: string | null;
  /** Set on merged inbox rows: how many notifications this row stands for. */
  count?: number;
  /** Ids folded into a merged row (the row's own id is first). */
  mergedIds?: string[];
};

/** payload.post_id, when present and a plausible uuid. */
function payloadPostId(payload: Record<string, unknown> | null): string | null {
  const value = payload?.post_id ?? payload?.postId;
  return typeof value === "string" && value.length >= 32 ? value : null;
}

/** Activity feed for the inbox — everything except friend_request (shown as
 *  actionable requests) and post_view (too noisy). Newest first. */
export function useNotifications() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 20_000,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, actor_id, read, created_at, payload, actor:actor_id(display_name, username, avatar_url)")
        .eq("recipient_id", userId as string)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) {
        throw error;
      }
      const rows = (data ?? []) as unknown as {
        id: string;
        type: string;
        actor_id: string | null;
        read: boolean;
        created_at: string;
        payload: Record<string, unknown> | null;
        actor: { display_name: string; username: string; avatar_url: string | null } | null;
      }[];
      const kept = rows.filter(
        (row) =>
          row.type !== "friend_request" &&
          row.type !== "post_view" &&
          row.type !== "daily_nudge" &&
          row.type !== "arrival_buzz" &&
          // Group-chat pushes are collapsed and belong to the chat, not the inbox.
          row.type !== "community_message"
      );
      // Post previews: reaction/tag/answered-taunt payloads carry post_id —
      // one batched lookup + sign turns those into right-side thumbnails.
      // Actors hidden by RLS (you blocked them, or they blocked you) come back
      // with actor = null, which used to render as "Someone sent you a
      // message". Resolve name/handle/avatar through the security-definer
      // profile_lite RPC so the row still says who it was.
      const hiddenActorIds = [...new Set(kept.filter((r) => r.actor_id && !r.actor).map((r) => r.actor_id as string))];
      const liteById = new Map<string, { display_name: string; username: string; avatar_url: string | null }>();
      if (hiddenActorIds.length) {
        const { data: lite } = await supabase.rpc("profile_lite", { p_ids: hiddenActorIds });
        for (const p of lite ?? []) liteById.set(p.id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url });
      }
      for (const row of kept) {
        if (!row.actor && row.actor_id && liteById.has(row.actor_id)) row.actor = liteById.get(row.actor_id) ?? null;
      }
      const postIds = [...new Set(kept.map((row) => payloadPostId(row.payload)).filter((id): id is string => Boolean(id)))];
      const thumbByPost = new Map<string, string>();
      if (postIds.length) {
        const { data: posts } = await supabase
          .from("posts")
          .select("id, media_url, thumbnail_url, media_type")
          .in("id", postIds);
        const rowsById = new Map((posts ?? []).map((p) => [p.id, p]));
        const signed = await signedPostUrls(
          (posts ?? []).flatMap((p) => [p.thumbnail_url, p.media_type === "video" ? null : p.media_url])
        );
        const resolve = (path: string | null): string | null => {
          if (!path) return null;
          if (path.startsWith("http")) return path;
          return signed.get(path) ?? null;
        };
        for (const id of postIds) {
          const post = rowsById.get(id);
          if (!post) continue;
          const thumb = resolve(post.thumbnail_url) ?? (post.media_type === "video" ? null : resolve(post.media_url));
          if (thumb) thumbByPost.set(id, thumb);
        }
      }
      return kept.map((row) => ({
        id: row.id,
        type: row.type,
        actorId: row.actor_id,
        actorName: row.type === "system_notice" ? "Spotted" : row.type === "trophy_unlocked" ? "You" : row.actor?.display_name ?? "Someone",
        actorUsername: row.actor?.username ?? null,
        actorAvatar: row.actor?.avatar_url ?? null,
        read: row.read,
        createdAt: row.created_at,
        payload: row.payload,
        postThumbUrl: (() => {
          const id = payloadPostId(row.payload);
          return id ? thumbByPost.get(id) ?? null : null;
        })()
      }));
    }
  });
}

/** Badge count for the inbox button: incoming requests + unread notifications. */
export function useActivityUnreadCount(): number {
  const notifications = useNotifications();
  const requests = useIncomingRequests();
  const unreadNotifs = (notifications.data ?? []).filter((n) => !n.read).length;
  const requestCount = requests.data?.length ?? 0;
  return unreadNotifs + requestCount;
}

/**
 * Opening a conversation marks its DM notifications read (instead of leaving
 * "sent you a message" rows unread until the inbox itself is opened).
 */
export function useMarkConversationNotificationsRead(conversationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured || !userId || !conversationId) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", userId)
        .eq("type", "dm")
        .eq("read", false)
        .eq("payload->>conversation_id", conversationId);
    },
    onMutate: async () => {
      const queryKey = ["notifications", userId];
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<AppNotification[]>(queryKey, (prev) =>
        prev?.map((n) =>
          !n.read && n.type === "dm" && n.payload?.conversation_id === conversationId ? { ...n, read: true } : n
        )
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["notifications", userId] })
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured || !userId) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("recipient_id", userId)
        .eq("read", false);
    },
    // Instantly clear every unread flag (the inbox badge is derived from these
    // rows in useActivityUnreadCount) and the OS badge.
    onMutate: async () => {
      const queryKey = ["notifications", userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKey);
      queryClient.setQueryData<AppNotification[]>(queryKey, (prev) =>
        prev?.map((notification) =>
          notification.read ? notification : { ...notification, read: true }
        )
      );
      void Notifications.setBadgeCountAsync(0).catch(() => false);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId], context.previous);
      }
      showToast("Couldn't mark notifications as read");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });
}
