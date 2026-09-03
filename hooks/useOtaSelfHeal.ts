import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Pull EAS Updates on foreground, not only on cold start.
 *
 * expo-updates checks for a new bundle once, at launch, and applies it on the
 * launch after that. iOS keeps apps suspended for days, so a device that
 * picked up a bad bundle (the unconfigured 2026-09-02 update) kept running it
 * through every "reopen" until the user force-quit twice — which is why the
 * fix looked like it never arrived. This hook:
 *   1. checks + downloads a pending update whenever the app comes to the
 *      foreground (throttled), and
 *   2. applies a downloaded update on the NEXT foreground — the moment the
 *      user is already staring at a fresh screen, so a reload is invisible.
 * A cold start still applies it too (expo-updates default behaviour).
 */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export function useOtaSelfHeal() {
  const lastCheck = useRef(0);
  const pendingReload = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const run = async () => {
      if (pendingReload.current) {
        pendingReload.current = false;
        await Updates.reloadAsync();
        return;
      }
      const now = Date.now();
      if (now - lastCheck.current < CHECK_INTERVAL_MS) return;
      lastCheck.current = now;
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) pendingReload.current = true;
    };

    const tick = () => {
      run().catch(() => {
        // Offline / EAS unreachable: the next foreground or cold start retries.
      });
    };

    tick();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => sub.remove();
  }, []);
}
