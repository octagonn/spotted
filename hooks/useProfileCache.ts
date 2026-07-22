import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useAuthStore } from "@/stores/auth";

/**
 * Instant own-profile loads (profile spec #19): the profile + posts query
 * results are mirrored to AsyncStorage and seeded back into the React Query
 * cache at app start, so the profile screen renders immediately from the last
 * known data while the network refresh happens in the background.
 */
const KEY = (profileId: string) => `profile-snapshot:${profileId}`;

/** Query keys worth snapshotting for the profile screen's first paint. */
const SNAPSHOT_KEYS = (profileId: string): unknown[][] => [
  ["profile", "me", profileId],
  ["user-posts", profileId],
  ["workouts", profileId]
];

export function useProfileCache() {
  const queryClient = useQueryClient();
  const profileId = useAuthStore((state) => state.profileId);
  const hydratedFor = useRef<string | null>(null);

  // Hydrate once per account, as soon as we know who's signed in.
  useEffect(() => {
    if (!profileId || hydratedFor.current === profileId) return;
    hydratedFor.current = profileId;
    void AsyncStorage.getItem(KEY(profileId)).then((raw) => {
      if (!raw) return;
      try {
        const entries = JSON.parse(raw) as [unknown[], unknown][];
        for (const [key, data] of entries) {
          // Seed only if nothing fresher is already in the cache — the seed is
          // stale-by-definition, so queries still refetch in the background.
          if (queryClient.getQueryData(key) === undefined && data !== undefined) {
            queryClient.setQueryData(key, data);
          }
        }
      } catch {
        // corrupt snapshot — drop it
        void AsyncStorage.removeItem(KEY(profileId));
      }
    });
  }, [profileId, queryClient]);

  // Persist on every successful update of the snapshotted queries (debounced).
  useEffect(() => {
    if (!profileId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const keys = SNAPSHOT_KEYS(profileId);
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.state.status !== "success") return;
      const hash = JSON.stringify(event.query.queryKey);
      if (!keys.some((k) => JSON.stringify(k) === hash)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const entries = keys
          .map((k) => [k, queryClient.getQueryData(k)] as [unknown[], unknown])
          .filter(([, data]) => data !== undefined);
        void AsyncStorage.setItem(KEY(profileId), JSON.stringify(entries)).catch(() => undefined);
      }, 800);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [profileId, queryClient]);
}
