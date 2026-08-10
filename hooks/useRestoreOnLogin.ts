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
    // Reset the guard on sign-out so a subsequent login re-runs — even as the
    // SAME user. The delete→sign-out→sign-back-in-to-cancel flow keeps the same
    // userId, and because the root layout never unmounts, doneRef would stay
    // pinned to that id and skip the restore, stranding the account in
    // pending_deletion while it's actively in use (heading for a silent purge).
    if (!userId) {
      doneRef.current = null;
      return;
    }
    if (!isSupabaseConfigured || doneRef.current === userId) return;
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
