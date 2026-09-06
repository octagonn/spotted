import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MOCK_CONVERSATION_ID, mockMessages } from "@/lib/mockData";
import { compressChatPhoto } from "@/lib/posts";
import { removePostObjects, uploadMediaObject } from "@/lib/r2";
import { isDemoMode, isSupabaseConfigured, signedMessageUrl, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import type { Database } from "@/types/database";

export type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

// Unique optimistic id. Date.now() alone collides when a media send and its
// caption text fire in the same synchronous tick (both onMutate run before any
// await), producing two rows with the same id → duplicate React keys and a
// mis-reconciled bubble. The counter guarantees uniqueness.
let tempSeq = 0;
const nextTempId = () => `temp-${Date.now()}-${tempSeq++}`;

/**
 * Chat routes are pushed as /chat/<profile id> (see feed.tsx and friends.tsx),
 * so this resolves the other user's id to a conversation id, creating the
 * conversation on first open.
 */
export function useConversation(otherUserId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["conversation", userId, otherUserId],
    enabled: Boolean(otherUserId) && (isDemoMode || Boolean(userId)),
    queryFn: async (): Promise<string | null> => {
      if (!otherUserId) {
        return null;
      }
      if (isDemoMode) {
        return MOCK_CONVERSATION_ID;
      }
      if (!userId) {
        return null;
      }
      const { data, error } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_a.eq.${userId},participant_b.eq.${otherUserId}),and(participant_a.eq.${otherUserId},participant_b.eq.${userId})`
        )
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (data) {
        return data.id;
      }
      // DB enforces CHECK (participant_a < participant_b) — insert the sorted
      // pair or creation fails for half of all user pairs.
      const [a, b] = [userId, otherUserId].sort();
      const inserted = await supabase
        .from("conversations")
        .insert({ participant_a: a, participant_b: b })
        .select("id")
        .single();
      if (inserted.error) {
        // Possible race with the other participant creating it concurrently — retry the lookup.
        const retry = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(participant_a.eq.${userId},participant_b.eq.${otherUserId}),and(participant_a.eq.${otherUserId},participant_b.eq.${userId})`
          )
          .limit(1)
          .maybeSingle();
        if (retry.data) {
          return retry.data.id;
        }
        throw inserted.error;
      }
      return inserted.data.id;
    }
  });
}

export function useMessages(conversationId?: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    // Open-thread fallback when a realtime event is dropped: a visible chat
    // should never sit stale for more than a few seconds.
    refetchInterval: 15_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) {
        return [];
      }
      if (isDemoMode) {
        return [...mockMessages];
      }
      // Deleted-for-me: my participant row's cleared_at hides everything at or
      // before that moment (the other participant still sees full history).
      const { data: me } = await supabase.auth.getUser();
      const { data: part } = me.user
        ? await supabase
            .from("conversation_participants")
            .select("cleared_at")
            .eq("conversation_id", conversationId)
            .eq("user_id", me.user.id)
            .maybeSingle()
        : { data: null };
      let query = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true })
        .limit(200);
      const clearedAt = (part as { cleared_at?: string | null } | null)?.cleared_at;
      if (clearedAt) query = query.gt("sent_at", clearedAt);
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      return data ?? [];
    }
  });
}

export function useSendMessage(conversationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    // Accepts a bare string (legacy call sites) or { content, replyToId } for
    // quote-replies (#10).
    mutationFn: async (input: string | { content: string; replyToId?: string | null }): Promise<void> => {
      const content = typeof input === "string" ? input : input.content;
      const replyToId = typeof input === "string" ? null : input.replyToId ?? null;
      const trimmed = content.trim();
      if (!conversationId || trimmed.length === 0) {
        return;
      }
      if (isDemoMode) {
        const local: ChatMessage = {
          id: `local-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: userId ?? "mock-user",
          content: trimmed,
          media_url: null,
          reply_story_media: null,
          sent_at: new Date().toISOString(),
          read_at: null,
          reply_to_id: replyToId ?? null,
          deleted_at: null,
          kind: "text",
          shared_kind: null,
          shared_id: null,
          view_once: false,
          viewed_at: null
        };
        queryClient.setQueryData<ChatMessage[]>(["messages", conversationId], (prev) => [
          ...(prev ?? []),
          local
        ]);
        return;
      }
      if (!userId) {
        return;
      }
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: trimmed,
        reply_to_id: replyToId
      });
      if (error) {
        throw error;
      }
      trackAnalyticsEvent("message_sent", { reply: Boolean(replyToId) });
    },
    // Optimistic echo (real path only — the mock path inserts inside mutationFn):
    // append a temp row instantly; the realtime/invalidate flow reconciles it
    // with the server row via the onSettled refetch.
    onMutate: async (input) => {
      if (!isSupabaseConfigured || !conversationId || !userId) {
        return undefined;
      }
      const content = typeof input === "string" ? input : input.content;
      const replyToId = typeof input === "string" ? null : input.replyToId ?? null;
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      const queryKey = ["messages", conversationId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChatMessage[]>(queryKey);
      const temp: ChatMessage = {
        id: nextTempId(),
        conversation_id: conversationId,
        sender_id: userId,
        content: trimmed,
        media_url: null,
        reply_story_media: null,
        sent_at: new Date().toISOString(),
        read_at: null,
        reply_to_id: replyToId,
        deleted_at: null,
        kind: "text",
        shared_kind: null,
        shared_id: null,
        view_once: false,
        viewed_at: null
      };
      queryClient.setQueryData<ChatMessage[]>(queryKey, (prev) => [...(prev ?? []), temp]);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["messages", conversationId], context.previous);
      }
      showToast("Message failed to send");
    },
    onSettled: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
    }
  });
}

export type MediaMessageInput = {
  /** Local file URI (photo, video, or a recorded .m4a). */
  localUri: string;
  kind: "image" | "audio" | "video";
  /** Snapchat-style: the recipient can open this photo exactly once. */
  viewOnce?: boolean;
};

const MEDIA_CFG: Record<MediaMessageInput["kind"], { ext: string; type: string; label: string }> = {
  image: { ext: "jpg", type: "image/jpeg", label: "Photo" },
  // "audio/m4a" is NOT a real MIME type — an .m4a file is MPEG-4 audio. Storage
  // matches the bucket's allow-list on this exact string, so the bogus value
  // (combined with the bucket having no audio type at all) rejected every voice
  // note before it left the device.
  audio: { ext: "m4a", type: "audio/mp4", label: "Voice message" },
  video: { ext: "mp4", type: "video/mp4", label: "Video" }
};

/** Upload chat media (photo / video / voice note) and insert the message row. */
export function useSendMediaMessage(conversationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ localUri, kind, viewOnce }: MediaMessageInput): Promise<void> => {
      if (!isSupabaseConfigured || !conversationId || !userId) {
        throw new Error("Not ready to send");
      }
      const cfg = MEDIA_CFG[kind];
      const uploadUri = kind === "image" ? await compressChatPhoto(localUri) : localUri;
      const response = await fetch(uploadUri);
      const body = await response.arrayBuffer();
      if (!body || body.byteLength === 0) {
        throw new Error("The file could not be read.");
      }
      const path = await uploadMediaObject(`${userId}/${conversationId}-${Date.now()}.${cfg.ext}`, body, cfg.type);
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        // Placeholder text keeps inbox previews readable.
        content: viewOnce ? "Photo" : cfg.label,
        media_url: path,
        view_once: Boolean(viewOnce)
      });
      if (error) {
        await removePostObjects([path]).catch(() => {});
        throw error;
      }
    },
    // Optimistic bubble using the LOCAL uri so the media shows instantly; the
    // onSettled invalidate swaps it for the server row (storage path).
    onMutate: async ({ localUri, kind, viewOnce }) => {
      if (!isSupabaseConfigured || !conversationId || !userId) {
        return undefined;
      }
      const queryKey = ["messages", conversationId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChatMessage[]>(queryKey);
      const temp: ChatMessage = {
        id: nextTempId(),
        conversation_id: conversationId,
        sender_id: userId,
        content: viewOnce ? "Photo" : MEDIA_CFG[kind].label,
        media_url: localUri,
        reply_story_media: null,
        sent_at: new Date().toISOString(),
        read_at: null,
        reply_to_id: null,
        deleted_at: null,
        kind: "text",
        shared_kind: null,
        shared_id: null,
        view_once: Boolean(viewOnce),
        viewed_at: null
      };
      queryClient.setQueryData<ChatMessage[]>(queryKey, (prev) => [...(prev ?? []), temp]);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["messages", conversationId], context.previous);
      }
      showToast("Couldn't send that — try again");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  });
}

/** Live updates: refetch the thread whenever a message in this conversation changes. */
export function useMessagesRealtime(conversationId?: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId) {
      return;
    }
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          // INSERT: append straight into the cache so the bubble lands without
          // a refetch round-trip. Anything else (edits, unsends) refetches.
          if (payload.eventType === "INSERT" && payload.new) {
            const incoming = payload.new as ChatMessage;
            queryClient.setQueryData<ChatMessage[]>(["messages", conversationId], (current) => {
              if (!current) return current;
              if (current.some((m) => m.id === incoming.id)) return current;
              return [...current, incoming];
            });
          }
          void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

/** Mark the other participant's messages as read when the thread is open. */
export function useMarkConversationRead(conversationId?: string | null, messageCount?: number, isGroup = false) {
  const userId = useAuthStore((state) => state.userId);
  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId || !userId || !messageCount) {
      return;
    }
    if (isGroup) {
      // Groups track read state PER MEMBER (last_read_at on my participant
      // row) — the shared messages.read_at stamp would clear everyone's
      // unread the moment one member opened the thread.
      void supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) {
            console.warn("Failed to mark group read", error.message);
          }
        });
      return;
    }
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .is("read_at", null)
      .then(({ error }) => {
        if (error) {
          console.warn("Failed to mark conversation read", error.message);
        }
      });
  }, [conversationId, userId, messageCount, isGroup]);
}

export type ChatMediaItem = {
  id: string;
  kind: "image" | "video";
  uri: string;
  sentAt: string;
};

/**
 * Every photo and video sent in a conversation, newest first — the
 * details-screen media gallery (iMessage/IG-style). View-once photos, unsent
 * messages, voice notes, and anything before my "delete for me" point never
 * appear.
 */
export function useChatMedia(conversationId?: string | null, enabled = true) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["chat-media", conversationId],
    enabled: isSupabaseConfigured && Boolean(conversationId) && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ChatMediaItem[]> => {
      const { data: part } = userId
        ? await supabase
            .from("conversation_participants")
            .select("cleared_at")
            .eq("conversation_id", conversationId as string)
            .eq("user_id", userId)
            .maybeSingle()
        : { data: null };
      let query = supabase
        .from("messages")
        .select("id, media_url, sent_at")
        .eq("conversation_id", conversationId as string)
        .not("media_url", "is", null)
        .is("deleted_at", null)
        .eq("view_once", false)
        .order("sent_at", { ascending: false })
        .limit(90);
      const clearedAt = (part as { cleared_at?: string | null } | null)?.cleared_at;
      if (clearedAt) query = query.gt("sent_at", clearedAt);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as { id: string; media_url: string; sent_at: string }[];
      const media = rows.flatMap((r) => {
        // Chat uploads are keyed by extension: .jpg photo, .mp4 video, .m4a
        // voice note (never in the gallery).
        const kind = r.media_url.endsWith(".mp4") ? ("video" as const) : r.media_url.endsWith(".m4a") ? null : ("image" as const);
        return kind ? [{ id: r.id, kind, path: r.media_url, sentAt: r.sent_at }] : [];
      });
      const signed = await Promise.all(
        media.map(async (m) => {
          const uri = await signedMessageUrl(m.path).catch(() => null);
          return uri ? { id: m.id, kind: m.kind, uri, sentAt: m.sentAt } : null;
        })
      );
      return signed.filter((m): m is ChatMediaItem => Boolean(m));
    }
  });
}

/* ------------------------------ group chats ------------------------------ */

export type GroupMember = { id: string; name: string; username: string; avatarUrl: string | null };
/** title is the RAW custom title — null for unnamed groups; render sites
 *  derive the per-viewer display name via lib/groupName. */
export type GroupInfo = { id: string; title: string | null; createdBy: string | null; members: GroupMember[] };

/** Group thread metadata: title + full member list (drives the header and
 *  per-bubble sender names). Null for 1:1 conversations. */
export function useGroupInfo(conversationId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["group-info", conversationId],
    enabled: isSupabaseConfigured && Boolean(conversationId) && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<GroupInfo | null> => {
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("id, is_group, title, created_by")
        .eq("id", conversationId as string)
        .maybeSingle();
      if (error) throw error;
      if (!conv?.is_group) return null;
      const { data: parts, error: partsError } = await supabase
        .from("conversation_participants")
        .select("user_id, profile:user_id(id, display_name, username, avatar_url)")
        .eq("conversation_id", conversationId as string);
      if (partsError) throw partsError;
      type PartRow = { user_id: string; profile: { id: string; display_name: string; username: string; avatar_url: string | null } | null };
      const members: GroupMember[] = ((parts ?? []) as unknown as PartRow[])
        .filter((p): p is PartRow & { profile: NonNullable<PartRow["profile"]> } => Boolean(p.profile))
        .map((p) => ({
          id: p.profile.id,
          name: p.profile.display_name,
          username: p.profile.username,
          avatarUrl: p.profile.avatar_url
        }));
      return { id: conv.id, title: conv.title, createdBy: conv.created_by, members };
    }
  });
}

/** Create a group chat (creator + friends, server-validated). Returns the
 *  conversation id to route into. */
export function useCreateGroupConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, memberIds }: { title: string; memberIds: string[] }): Promise<string> => {
      const { data, error } = await supabase.rpc("create_group_conversation", {
        p_title: title,
        p_member_ids: memberIds
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inbox-threads"] })
  });
}

/** Rename a group — any member may (conversations_update_member policy). */
export function useRenameGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, title }: { conversationId: string; title: string }) => {
      const trimmed = title.trim().slice(0, 40);
      if (!trimmed) throw new Error("empty_title");
      const { error } = await supabase.from("conversations").update({ title: trimmed }).eq("id", conversationId);
      if (error) throw error;
      return trimmed;
    },
    onSuccess: (_title, { conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: ["group-info", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-threads"] });
    }
  });
}

/** Add friends to an existing group (any member may add their own friends). */
export function useAddGroupMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, memberIds }: { conversationId: string; memberIds: string[] }) => {
      const { error } = await supabase.rpc("add_group_members", {
        p_conversation: conversationId,
        p_member_ids: memberIds
      });
      if (error) throw error;
    },
    onSuccess: (_data, { conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: ["group-info", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-threads"] });
    }
  });
}

/** Leave a group — deletes my membership row; the thread vanishes for me. */
export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!isSupabaseConfigured || !userId) return;
      const { error } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inbox-threads"] })
  });
}

/** Recipient opens a view-once photo — burn it (RPC guards participant/sender). */
export function useMarkMessageViewed(conversationId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string): Promise<void> => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.rpc("mark_message_viewed", { p_message: messageId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  });
}
