import { useEffect, useRef } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Restore-on-login (§7): if the signed-in account is deactivated or pending
 * deletion, logging back in reactivates / cancels the deletion. Runs once per
 * signed-in session.
 */
export function useRestoreOnLogin(userId: string | null) {
  const doneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured || !userId || doneRef.current === userId) return;
    doneRef.current = userId;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("account_status")
          .eq("id", userId)
          .maybeSingle();
        const status = data?.account_status;
        if (status === "deactivated") {
          await supabase.rpc("reactivate_account");
        } else if (status === "pending_deletion") {
          await supabase.rpc("restore_account");
        }
      } catch (error) {
        logger.warn("restore_on_login_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  }, [userId]);
}
