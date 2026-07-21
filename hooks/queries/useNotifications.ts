import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useIncomingRequests } from "@/hooks/queries/useFriends";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

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
};

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
      return rows
        .filter((row) => row.type !== "friend_request" && row.type !== "post_view")
        .map((row) => ({
          id: row.id,
          type: row.type,
          actorId: row.actor_id,
          actorName: row.actor?.display_name ?? "Someone",
          actorUsername: row.actor?.username ?? null,
          actorAvatar: row.actor?.avatar_url ?? null,
          read: row.read,
          createdAt: row.created_at,
          payload: row.payload
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });
}
