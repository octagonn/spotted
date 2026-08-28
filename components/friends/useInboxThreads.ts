import { useQuery, useQueryClient } from "@tanstack/react-query";

import { groupDisplayName } from "@/lib/groupName";
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
  /** Other participant's profile id — the /chat/[id] route param for real 1:1
   *  DMs. Empty string for group threads (route by conversationId instead). */
  profileId: string;
  conversationId: string;
  /** Group chat: name = group title, avatar = initials, unread via my
   *  last_read_at (per-member), route = /chat/[conversationId]?group=1. */
  isGroup: boolean;
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
    // Fallback for dropped realtime events: new DMs (and the tab badge, which
    // reads this query) must not require backgrounding the app to appear.
    refetchInterval: 30_000,
    queryFn: async (): Promise<RealInboxThread[]> => {
      if (!userId) {
        return [];
      }
      // Discovery via MY membership rows — the participant_a/b pair filter
      // can't see group conversations (their pair columns are null).
      const { data: myParts, error: partsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, muted, folder_id, cleared_at, last_read_at")
        .eq("user_id", userId);
      if (partsError) throw partsError;
      const myIds = (myParts ?? []).map((p) => p.conversation_id);
      if (myIds.length === 0) return [];
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id, participant_a, participant_b, last_message_at, updated_at, status, is_group, title")
        .in("id", myIds);
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
      const otherIds = convoList
        .filter((convo) => !convo.is_group)
        .map((convo) => (convo.participant_a === userId ? convo.participant_b : convo.participant_a))
        .filter((id): id is string => Boolean(id));

      const [profilesResult, messagesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, subscription_tier")
          .in("id", otherIds),
        supabase
          .from("messages")
          .select("conversation_id, sender_id, content, sent_at, read_at, reply_story_media")
          .in("conversation_id", conversationIds)
          .order("sent_at", { ascending: false })
          .limit(400)
      ]);
      const participantResult = { data: myParts };
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

      // Deleted-for-me threads: messages at or before my cleared_at don't
      // exist from my side. A newer message resurrects the thread.
      const clearedByConversation = new Map<string, string>();
      for (const p of participantResult.data ?? []) {
        const cleared = (p as { cleared_at?: string | null }).cleared_at;
        if (cleared) clearedByConversation.set(p.conversation_id, cleared);
      }

      type MessageRow = NonNullable<typeof messagesResult.data>[number];
      const lastByConversation = new Map<string, MessageRow>();
      const unreadConversations = new Set<string>();
      for (const message of messagesResult.data ?? []) {
        const cleared = clearedByConversation.get(message.conversation_id);
        if (cleared && message.sent_at <= cleared) continue;
        if (!lastByConversation.has(message.conversation_id)) {
          lastByConversation.set(message.conversation_id, message);
        }
        if (message.sender_id !== userId && message.read_at === null) {
          unreadConversations.add(message.conversation_id);
        }
      }

      // Group previews prefix the sender's first name ("Ryan: yo") — fetch
      // just those senders' profiles (small, groups only).
      const groupSenderIds = [
        ...new Set(
          convoList
            .filter((c) => c.is_group)
            .map((c) => lastByConversation.get(c.id)?.sender_id)
            .filter((id): id is string => Boolean(id) && id !== userId)
        )
      ];
      const groupSenders = new Map<string, string>();
      if (groupSenderIds.length) {
        const { data: senderRows } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", groupSenderIds);
        for (const row of senderRows ?? []) groupSenders.set(row.id, row.display_name);
      }

      // Untitled groups display PER-VIEWER: the OTHER members' first names
      // (a stored auto-name would bake in the creator's perspective).
      const unnamedGroupIds = convoList.filter((c) => c.is_group && !c.title?.trim()).map((c) => c.id);
      const groupNameByConv = new Map<string, string>();
      if (unnamedGroupIds.length) {
        const { data: memberRows } = await supabase
          .from("conversation_participants")
          .select("conversation_id, user_id, profile:user_id(display_name)")
          .in("conversation_id", unnamedGroupIds);
        const byConv = new Map<string, { id: string; name: string }[]>();
        for (const row of (memberRows ?? []) as unknown as {
          conversation_id: string;
          user_id: string;
          profile: { display_name: string } | null;
        }[]) {
          if (!row.profile) continue;
          const list = byConv.get(row.conversation_id) ?? [];
          list.push({ id: row.user_id, name: row.profile.display_name });
          byConv.set(row.conversation_id, list);
        }
        for (const [convId, list] of byConv) {
          groupNameByConv.set(convId, groupDisplayName(null, list, userId));
        }
      }

      const threads: RealInboxThread[] = [];
      for (const convo of convoList) {
        const part = partById.get(convo.id);
        if (convo.is_group) {
          const last = lastByConversation.get(convo.id);
          if (clearedByConversation.has(convo.id) && !last) continue;
          const lastRead = (part as { last_read_at?: string | null } | undefined)?.last_read_at ?? null;
          const senderName = last ? groupSenders.get(last.sender_id)?.split(" ")[0] : undefined;
          threads.push({
            profileId: "",
            conversationId: convo.id,
            isGroup: true,
            name: convo.title?.trim() || (groupNameByConv.get(convo.id) ?? "Group"),
            username: "",
            avatarUrl: null,
            preview: last
              ? last.sender_id === userId
                ? `You: ${last.content ?? ""}`
                : `${senderName ? `${senderName}: ` : ""}${last.content ?? ""}`
              : "Say hi to the group",
            time: timeAgo(last?.sent_at ?? convo.last_message_at ?? convo.updated_at),
            // Per-member unread: my last_read_at vs the newest message.
            unread: Boolean(last && last.sender_id !== userId && (!lastRead || last.sent_at > lastRead)),
            lastSentAt: last?.sent_at ?? convo.last_message_at ?? convo.updated_at,
            empty: !last,
            answered: !last || last.sender_id === userId,
            storyReply: false,
            verified: false,
            muted: part?.muted ?? false,
            folderId: part?.folder_id ?? null
          });
          continue;
        }
        const otherId = convo.participant_a === userId ? convo.participant_b : convo.participant_a;
        const profile = otherId ? profileById.get(otherId) : undefined;
        if (!otherId || !profile) {
          continue;
        }
        // Deleted for me with nothing newer → the thread stays gone (including
        // the "tap to start" placeholder state).
        if (clearedByConversation.has(convo.id) && !lastByConversation.get(convo.id)) {
          continue;
        }
        const verified = (profile as { subscription_tier?: string }).subscription_tier
          ? (profile as { subscription_tier?: string }).subscription_tier !== "free"
          : false;
        const last = lastByConversation.get(convo.id);
        // No messages yet (thread created on open but never used) — not a
        // conversation. The old "Tap to start conversation" placeholder rows
        // are gone; friends are messaged from their profile or the search.
        if (!last) continue;
        const content = last.content ?? "";
        threads.push({
          profileId: otherId,
          conversationId: convo.id,
          isGroup: false,
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
    /** Optimistically clear a thread's unread dot (row tap — server read marker
     *  follows in chat). Accepts a peer profile id (1:1) OR a conversation id
     *  (groups). */
    clearUnread: (key: string) => {
      queryClient.setQueriesData<RealInboxThread[]>({ queryKey: INBOX_QUERY_KEY }, (threads) =>
        threads?.map((thread) =>
          thread.profileId === key || thread.conversationId === key ? { ...thread, unread: false } : thread
        )
      );
    },
    /** Refetch the inbox (after sending a message in a real conversation). */
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY });
    }
  };
}
