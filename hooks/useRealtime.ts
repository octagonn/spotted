import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function useRealtime(userId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      return;
    }
    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["post-viewers"] });
        }
      )
      // Messages: RLS scopes the stream to conversations I'm in ("my
      // conversations" isn't expressible as a channel filter). Any change
      // refreshes the inbox list + the affected thread, so new DMs land
      // instantly everywhere — not just inside an open chat.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { conversation_id?: string } | null;
          void queryClient.invalidateQueries({ queryKey: ["inbox-threads"] });
          void queryClient.invalidateQueries({ queryKey: ["message-requests"] });
          if (row?.conversation_id) {
            void queryClient.invalidateQueries({ queryKey: ["messages", row.conversation_id] });
          }
        }
      )
      // Posts: friends' new SPOTTEDs should land while the app is open —
      // before this, nothing pushed feed changes and users had to background
      // the app (or pull-to-refresh) to see new posts. RLS scopes the stream
      // to posts this user is allowed to see.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const row = payload.new as { user_id?: string } | null;
          // Own inserts already invalidate on publish; skip the echo.
          if (row?.user_id === userId) return;
          void queryClient.invalidateQueries({ queryKey: ["feed"] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
