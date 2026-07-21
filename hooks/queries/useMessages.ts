import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MOCK_CONVERSATION_ID, mockMessages } from "@/lib/mockData";
import { compressStoryPhoto } from "@/lib/posts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Database } from "@/types/database";

export type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

/**
 * Chat routes are pushed as /chat/<profile id> (see feed.tsx and friends.tsx),
 * so this resolves the other user's id to a conversation id, creating the
 * conversation on first open.
 */
export function useConversation(otherUserId?: string) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["conversation", userId, otherUserId],
    enabled: Boolean(otherUserId) && (!isSupabaseConfigured || Boolean(userId)),
    queryFn: async (): Promise<string | null> => {
      if (!otherUserId) {
        return null;
      }
      if (!isSupabaseConfigured) {
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
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) {
        return [];
      }
      if (!isSupabaseConfigured) {
        return [...mockMessages];
      }
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true })
        .limit(200);
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
      if (!isSupabaseConfigured) {
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
          shared_id: null
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
    },
    onSuccess: async () => {
      if (isSupabaseConfigured) {
        await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
    }
  });
}

export type MediaMessageInput = {
  /** Local file URI (photo, video, or a recorded .m4a). */
  localUri: string;
  kind: "image" | "audio" | "video";
};

const MEDIA_CFG: Record<MediaMessageInput["kind"], { ext: string; type: string; label: string }> = {
  image: { ext: "jpg", type: "image/jpeg", label: "📷 Photo" },
  audio: { ext: "m4a", type: "audio/m4a", label: "🎤 Voice message" },
  video: { ext: "mp4", type: "video/mp4", label: "🎥 Video" }
};

/** Upload chat media (photo / video / voice note) and insert the message row. */
export function useSendMediaMessage(conversationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async ({ localUri, kind }: MediaMessageInput): Promise<void> => {
      if (!isSupabaseConfigured || !conversationId || !userId) {
        throw new Error("Not ready to send");
      }
      const cfg = MEDIA_CFG[kind];
      const uploadUri = kind === "image" ? await compressStoryPhoto(localUri) : localUri;
      const response = await fetch(uploadUri);
      const body = await response.arrayBuffer();
      if (!body || body.byteLength === 0) {
        throw new Error("The file could not be read.");
      }
      const path = `${userId}/${conversationId}-${Date.now()}.${cfg.ext}`;
      const upload = await supabase.storage.from("messages").upload(path, body, {
        contentType: cfg.type,
        upsert: false
      });
      if (upload.error) {
        throw upload.error;
      }
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        // Placeholder text keeps inbox previews readable.
        content: cfg.label,
        media_url: path
      });
      if (error) {
        await supabase.storage.from("messages").remove([path]).catch(() => {});
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
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
        () => {
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
export function useMarkConversationRead(conversationId?: string | null, messageCount?: number) {
  const userId = useAuthStore((state) => state.userId);
  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId || !userId || !messageCount) {
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
  }, [conversationId, userId, messageCount]);
}
