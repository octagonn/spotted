import { useCallback, useEffect, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/**
 * Realtime typing indicator (#12) + online presence for a 1:1 thread, over a
 * per-conversation Supabase Realtime channel. Typing is a throttled broadcast;
 * "online" is presence-tracked. Respects the other user's activity toggle at
 * the display layer (their status is hidden if they turned it off — see
 * useActivityStatus). Returns whether the other party is typing/online and a
 * `notifyTyping()` to call on each keystroke.
 */
export function useChatPresence(conversationId?: string | null, otherUserId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId || !userId) return;
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: { presence: { key: userId } }
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId && payload.payload.userId !== userId) {
          setOtherTyping(true);
          clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setOtherTyping(false), 3500);
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((k) => k !== userId);
        setOtherOnline(others.length > 0);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ online: true });
      });
    channelRef.current = channel;
    return () => {
      clearTimeout(typingTimer.current);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < 1200) return; // throttle
    lastSent.current = now;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId } });
  }, [userId]);

  return { otherTyping, otherOnline, notifyTyping };
}

/**
 * The other user's shared "last seen"/activity, honoring privacy (#13): if the
 * VIEWER turned their own activity off, they can't see anyone's status either.
 * Combined with the live `otherOnline` above to show "Active now" vs "Active
 * 5m ago".
 */
export function useActivityStatus(otherUserId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["activity-status", otherUserId, userId],
    enabled: isSupabaseConfigured && Boolean(otherUserId) && Boolean(userId),
    staleTime: 20_000,
    queryFn: async (): Promise<{ lastSeenAt: string | null; visible: boolean }> => {
      // If I hide my activity, I don't get to see others' either.
      const me = await supabase.from("profiles").select("show_activity").eq("id", userId as string).maybeSingle();
      if (me.data?.show_activity === false) return { lastSeenAt: null, visible: false };
      const { data } = await supabase
        .from("profiles")
        .select("last_seen_at, show_activity")
        .eq("id", otherUserId as string)
        .maybeSingle();
      if (!data || data.show_activity === false) return { lastSeenAt: null, visible: false };
      return { lastSeenAt: data.last_seen_at, visible: true };
    }
  });
}

/** Heartbeat the current user's last_seen_at while a screen is focused. */
export function useHeartbeat() {
  const userId = useAuthStore((state) => state.userId);
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    const beat = () =>
      void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
    beat();
    const timer = setInterval(beat, 60_000);
    return () => clearInterval(timer);
  }, [userId]);
}
