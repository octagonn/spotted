import { useEffect } from "react";

import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Keep profiles.timezone in step with the device. The column defaulted to
 * 'UTC' and NOTHING ever wrote it, so every server-side "day" boundary —
 * taunt limits (5/day, 1/target/day), sender-posted checks, quiet hours —
 * ran on UTC midnight (5 PM Pacific for our users). That's why the taunt
 * limit felt like it "didn't reset with the new SPOTTED".
 */
export function useTimezoneSync(userId: string | null): void {
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    // Conditional update: no-op round trip when it already matches.
    void supabase
      .from("profiles")
      .update({ timezone: tz })
      .eq("id", userId)
      .neq("timezone", tz)
      .then(({ error }) => {
        if (error) logger.warn("timezone_sync_failed", { message: error.message });
      });
  }, [userId]);
}
