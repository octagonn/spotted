import { useEffect } from "react";
import { AppState } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { showBanner } from "@/stores/banner";

type ProfileLite = { id: string; username: string; display_name: string; avatar_url: string | null };

async function fetchProfile(id: string): Promise<ProfileLite | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", id)
    .maybeSingle();
  return (data as ProfileLite) ?? null;
}

/**
 * Shows top-of-screen banners for DMs and taunts received while the app is in
 * the foreground. DMs come from `messages` inserts (verified against the
 * conversation), taunts and other social events from `notifications` inserts.
 */
export function useInAppBanners(userId?: string | null) {
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel(`banners:${userId}`)
      // Taunts + social notifications addressed to me.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          if (AppState.currentState !== "active") return;
          const row = payload.new as { type: string; actor_id: string | null; payload: Record<string, unknown> | null };
          if (row.type !== "taunt") return; // taunts banner here; DMs handled below
          if (!row.actor_id) return;
          void (async () => {
            const actor = await fetchProfile(row.actor_id as string);
            if (!actor) return;
            showBanner({
              id: `taunt-${Date.now()}`,
              title: actor.display_name,
              body: `roasted you: "${String(row.payload?.text ?? "…")}"`,
              avatarName: actor.display_name,
              avatarUrl: actor.avatar_url,
              route: "/inbox"
            });
          })();
        }
      )
      // New DMs — any message not sent by me, in a conversation I'm part of.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (AppState.currentState !== "active") return;
          const msg = payload.new as { conversation_id: string; sender_id: string; content: string | null };
          if (msg.sender_id === userId) return;
          void (async () => {
            // Confirm I'm a participant of this conversation.
            const { data: convo } = await supabase
              .from("conversations")
              .select("participant_a, participant_b")
              .eq("id", msg.conversation_id)
              .maybeSingle();
            const parts = convo as { participant_a: string; participant_b: string } | null;
            if (!parts || (parts.participant_a !== userId && parts.participant_b !== userId)) return;
            const sender = await fetchProfile(msg.sender_id);
            if (!sender) return;
            showBanner({
              id: `dm-${Date.now()}`,
              title: sender.display_name,
              body: msg.content?.trim() || "Sent you a message",
              avatarName: sender.display_name,
              avatarUrl: sender.avatar_url,
              route: `/chat/${sender.id}`
            });
          })();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
