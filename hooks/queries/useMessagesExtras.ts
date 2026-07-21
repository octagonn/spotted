import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/**
 * DM epic extras: reactions (#9), unsend + per-view delete (#11), blocks
 * (#16), message requests (#15/18), and per-thread mute (#17). Kept separate
 * from useMessages so the core send/read path stays small.
 */

/* ------------------------- reactions (spec #9) ---------------------------- */

/** All reactions on a set of messages, keyed by message id. */
export function useMessageReactions(conversationId?: string | null, messageIds?: string[]) {
  const key = (messageIds ?? []).join(",");
  return useQuery({
    queryKey: ["message-reactions", conversationId, key],
    enabled: isSupabaseConfigured && Boolean(conversationId) && (messageIds?.length ?? 0) > 0,
    staleTime: 10_000,
    queryFn: async (): Promise<Record<string, { userId: string; emoji: string }[]>> => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds as string[]);
      if (error) throw error;
      const map: Record<string, { userId: string; emoji: string }[]> = {};
      for (const row of data ?? []) {
        (map[row.message_id] ??= []).push({ userId: row.user_id, emoji: row.emoji });
      }
      return map;
    }
  });
}

/** Long-press react: set (upsert) or clear your emoji on a message. */
export function useReactToMessage(conversationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string | null }) => {
      if (!isSupabaseConfigured || !userId) return;
      if (emoji) {
        const { error } = await supabase
          .from("message_reactions")
          .upsert({ message_id: messageId, user_id: userId, emoji });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["message-reactions", conversationId] })
  });
}

/* --------------------- unsend + per-view delete (#11) --------------------- */

/** Unsend your own message for BOTH parties (15-minute window, DB-enforced). */
export function useUnsendMessage(conversationId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase
        .from("messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] })
  });
}

/** The message ids the current user hid from their own view. */
export function useMessageHides() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["message-hides", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("message_hides").select("message_id");
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.message_id));
    }
  });
}

/** Delete a message from your own view only (any time). */
export function useHideMessage() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase
        .from("message_hides")
        .upsert({ message_id: messageId, user_id: userId });
      if (error) throw error;
    },
    onMutate: async (messageId) => {
      const key = ["message-hides", userId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Set<string>>(key);
      queryClient.setQueryData<Set<string>>(key, new Set([...(prev ?? []), messageId]));
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["message-hides", userId] })
  });
}

/* ------------------------------ blocks (#16) ------------------------------ */

export function useBlockedUsers() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["blocked-users", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("user_blocks").select("blocked_id");
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.blocked_id));
    }
  });
}

export function useSetBlocked() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ otherUserId, blocked }: { otherUserId: string; blocked: boolean }) => {
      if (!isSupabaseConfigured || !userId) return;
      if (blocked) {
        const { error } = await supabase
          .from("user_blocks")
          .upsert({ blocker_id: userId, blocked_id: otherUserId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_blocks")
          .delete()
          .eq("blocker_id", userId)
          .eq("blocked_id", otherUserId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["blocked-users", userId] });
      void queryClient.invalidateQueries({ queryKey: ["message-requests", userId] });
    }
  });
}

/* -------------------------- message requests (#15) ------------------------ */

export type MessageRequest = {
  conversationId: string;
  requesterId: string;
  requester: { username: string; display_name: string; avatar_url: string | null } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

/** Incoming message requests: request-state conversations someone else opened. */
export function useMessageRequests() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["message-requests", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<MessageRequest[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, requester_id, last_message_at, requester:requester_id(username, display_name, avatar_url)"
        )
        .eq("status", "request")
        .neq("requester_id", userId as string)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        requester_id: string;
        last_message_at: string | null;
        requester: { username: string; display_name: string; avatar_url: string | null } | null;
      }[];
      // Preview line per request (the pending message).
      return Promise.all(
        rows.map(async (row) => {
          const { data: msg } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", row.id)
            .is("deleted_at", null)
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return {
            conversationId: row.id,
            requesterId: row.requester_id,
            requester: row.requester,
            lastMessage: msg?.content ?? null,
            lastMessageAt: row.last_message_at
          };
        })
      );
    }
  });
}

/** Approve or decline (delete) an incoming message request. */
export function useRespondMessageRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ conversationId, accept }: { conversationId: string; accept: boolean }) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.rpc("respond_message_request", {
        p_conversation_id: conversationId,
        p_accept: accept
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["message-requests", userId] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-threads"] });
    }
  });
}

/* ------------------------- per-thread mute (#17) -------------------------- */

export function useConversationMuted(conversationId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["conversation-muted", conversationId, userId],
    enabled: isSupabaseConfigured && Boolean(conversationId) && Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("muted")
        .eq("conversation_id", conversationId as string)
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data?.muted ?? false;
    }
  });
}

export function useSetConversationMuted(conversationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (muted: boolean) => {
      if (!isSupabaseConfigured || !conversationId || !userId) return;
      const { error } = await supabase
        .from("conversation_participants")
        .update({ muted })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["conversation-muted", conversationId, userId] })
  });
}
