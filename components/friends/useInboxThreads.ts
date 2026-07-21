import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { useAuthStore } from "@/stores/auth";

/**
 * Real Messages inbox (spec §5.1) — lists the signed-in user's 1:1 conversations
 * (existing `conversations`/`messages` tables used by hooks/queries/useMessages.ts),
 * newest first, with `You: {text}` previews and unread flags. Only runs when
 * Supabase is configured; the UI merges these rows ABOVE the mock threads.
 */

export type RealInboxThread = {
  /** Other participant's profile id — the /chat/[id] route param for real DMs. */
  profileId: string;
  conversationId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  preview: string;
  /** Relative time, e.g. "12m", "2h". */
  time: string;
  unread: boolean;
  lastSentAt: string;
  /** True when the conversation has no messages yet (a "tap to start" thread). */
  empty: boolean;
  /** Filter signals (#1). */
  answered: boolean;
  storyReply: boolean;
  verified: boolean;
  muted: boolean;
  folderId: string | null;
};

const INBOX_QUERY_KEY = ["inbox-threads"] as const;

export function useInboxThreads() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: [...INBOX_QUERY_KEY, userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<RealInboxThread[]> => {
      if (!userId) {
        return [];
      }
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id, participant_a, participant_b, last_message_at, updated_at, status")
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
      if (error) {
        throw error;
      }
      // Main inbox = active threads only. Request-state threads live in the
      // Requests tab (#15).
      const convoList = (conversations ?? []).filter((c) => (c as { status?: string }).status !== "request");
      if (convoList.length === 0) {
        return [];
      }

      const conversationIds = convoList.map((convo) => convo.id);
      const otherIds = convoList.map((convo) =>
        convo.participant_a === userId ? convo.participant_b : convo.participant_a
      );

      const [profilesResult, messagesResult, participantResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, subscription_tier")
          .in("id", otherIds),
        supabase
          .from("messages")
          .select("conversation_id, sender_id, content, sent_at, read_at, reply_story_media")
          .in("conversation_id", conversationIds)
          .order("sent_at", { ascending: false })
          .limit(400),
        supabase
          .from("conversation_participants")
          .select("conversation_id, muted, folder_id")
          .eq("user_id", userId)
      ]);
      const partById = new Map(
        (participantResult.data ?? []).map((p) => [p.conversation_id, p])
      );
      if (profilesResult.error) {
        throw profilesResult.error;
      }
      if (messagesResult.error) {
        throw messagesResult.error;
      }

      const profileById = new Map(
        (profilesResult.data ?? []).map((profile) => [profile.id, profile])
      );

      type MessageRow = NonNullable<typeof messagesResult.data>[number];
      const lastByConversation = new Map<string, MessageRow>();
      const unreadConversations = new Set<string>();
      for (const message of messagesResult.data ?? []) {
        if (!lastByConversation.has(message.conversation_id)) {
          lastByConversation.set(message.conversation_id, message);
        }
        if (message.sender_id !== userId && message.read_at === null) {
          unreadConversations.add(message.conversation_id);
        }
      }

      const threads: RealInboxThread[] = [];
      for (const convo of convoList) {
        const otherId = convo.participant_a === userId ? convo.participant_b : convo.participant_a;
        const profile = profileById.get(otherId);
        if (!profile) {
          continue;
        }
        const part = partById.get(convo.id);
        const verified = (profile as { subscription_tier?: string }).subscription_tier
          ? (profile as { subscription_tier?: string }).subscription_tier !== "free"
          : false;
        const last = lastByConversation.get(convo.id);
        if (!last) {
          // New-friend thread with no messages yet — surface it so the handoff
          // ("say hi") prompt is reachable from Messages.
          const started = convo.last_message_at ?? convo.updated_at;
          threads.push({
            profileId: otherId,
            conversationId: convo.id,
            name: profile.display_name,
            username: profile.username,
            avatarUrl: profile.avatar_url,
            preview: "Tap to start conversation",
            time: timeAgo(started),
            unread: false,
            lastSentAt: started,
            empty: true,
            answered: true,
            storyReply: false,
            verified,
            muted: part?.muted ?? false,
            folderId: part?.folder_id ?? null
          });
          continue;
        }
        const content = last.content ?? "";
        threads.push({
          profileId: otherId,
          conversationId: convo.id,
          name: profile.display_name,
          username: profile.username,
          avatarUrl: profile.avatar_url,
          preview: last.sender_id === userId ? `You: ${content}` : content,
          time: timeAgo(last.sent_at),
          unread: unreadConversations.has(convo.id),
          lastSentAt: last.sent_at,
          empty: false,
          // Unanswered = the other person spoke last (needs your reply).
          answered: last.sender_id === userId,
          storyReply: Boolean((last as { reply_story_media?: string | null }).reply_story_media),
          verified,
          muted: part?.muted ?? false,
          folderId: part?.folder_id ?? null
        });
      }
      threads.sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
      return threads;
    }
  });
}

/** Imperative refresh + optimistic unread-clear helpers for the inbox list. */
export function useInboxThreadActions() {
  const queryClient = useQueryClient();
  return {
    /** Optimistically clear a thread's unread dot (row tap — server read marker follows in chat). */
    clearUnread: (profileId: string) => {
      queryClient.setQueriesData<RealInboxThread[]>({ queryKey: INBOX_QUERY_KEY }, (threads) =>
        threads?.map((thread) =>
          thread.profileId === profileId ? { ...thread, unread: false } : thread
        )
      );
    },
    /** Refetch the inbox (after sending a message in a real conversation). */
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY });
    }
  };
}
