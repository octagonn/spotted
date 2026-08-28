import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useBannerStore } from "@/stores/banner";

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
    const topic = `realtime:chat:${conversationId}`;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      // supabase.channel(name) hands back an EXISTING channel with that topic,
      // and removeChannel() from the previous mount is async — so a quick
      // re-mount (tap out and back into a thread, or React re-running effects)
      // got the old, already-subscribed channel and `.on("presence")` threw
      // "cannot add presence callbacks … after subscribe()" (the DM crash).
      // Tear down anything on this topic first, then build a fresh one.
      for (const stale of supabase.getChannels()) {
        if (stale.topic === topic) await supabase.removeChannel(stale);
      }
      if (cancelled) return;

      const next = supabase.channel(`chat:${conversationId}`, {
        config: { presence: { key: userId } }
      });
      channel = next;
      next
        .on("broadcast", { event: "typing" }, (payload) => {
          if (payload.payload?.userId && payload.payload.userId !== userId) {
            setOtherTyping(true);
            clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setOtherTyping(false), 3500);
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = next.presenceState();
          const others = Object.keys(state).filter((k) => k !== userId);
          setOtherOnline(others.length > 0);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && !cancelled) void next.track({ online: true });
        });
      channelRef.current = next;
    })();

    return () => {
      cancelled = true;
      clearTimeout(typingTimer.current);
      if (channel) void supabase.removeChannel(channel);
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

/**
 * While a thread is open, focused, and the app is active, tell the server
 * (every 30s; the trigger trusts it for 75s) so notify_dm() skips the push —
 * the message already appeared live. Cleared on blur/background/unmount.
 * Also drives the in-app banner suppression for that thread.
 */
export function useActiveConversation(conversationId?: string | null) {
  const userId = useAuthStore((state) => state.userId);
  const focused = useIsFocused();
  const setActive = useBannerStore((s) => s.setActiveConversation);
  useEffect(() => {
    if (!isSupabaseConfigured || !userId || !conversationId || !focused) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const ping = () => void supabase.rpc("set_active_conversation", { p_conversation: conversationId }).then(() => undefined, () => undefined);
    const clear = () => void supabase.rpc("set_active_conversation", { p_conversation: null }).then(() => undefined, () => undefined);
    const start = () => {
      setActive(conversationId);
      ping();
      clearInterval(timer);
      timer = setInterval(ping, 30_000);
    };
    const stop = () => {
      setActive(null);
      clearInterval(timer);
      timer = undefined;
      clear();
    };
    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (state) => (state === "active" ? start() : stop()));
    return () => {
      sub.remove();
      stop();
    };
  }, [conversationId, userId, focused, setActive]);
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
