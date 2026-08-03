import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import Constants from "expo-constants";

/**
 * App-wide QueryClient + persistence.
 *
 * Module-level (not React state) so non-React code — the auth store's sign-out
 * path — can wipe caches. The cache is persisted to AsyncStorage and restored
 * on launch, so screens paint instantly from the last session's data while a
 * background refetch runs (staleTime 30s keeps data honest; gcTime must
 * out-live relaunches or there'd be nothing to persist).
 *
 * AsyncStorage (not MMKV): react-native-mmkv needs a native module Expo Go
 * doesn't ship. Swap the persister's storage to MMKV once dev-client-only.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1
    }
  }
});

/** Query keys that must never be persisted (ephemeral/presence/search). */
const EPHEMERAL_KEYS = new Set([
  "live-presence",
  "activity-status",
  "crew-activity",
  "gym-presence",
  "review-queue",
  "message-reactions",
  "track-search",
  "people-search",
  "story-viewers",
  "story-likers",
  "post-viewers"
]);

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "spotted-query-cache-v1",
  throttleTime: 2_000
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 24 * 60 * 60 * 1000,
  // New app version = drop the old cache shape.
  buster: Constants.expoConfig?.version ?? "0",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) => {
      if (query.state.status !== "success") return false;
      const head = query.queryKey[0];
      return !(typeof head === "string" && EPHEMERAL_KEYS.has(head));
    }
  }
};

/** Full wipe on sign-out — no cross-account residue, in memory or on disk. */
export async function wipeQueryCaches(): Promise<void> {
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch {
    // best-effort — a failed disk wipe still leaves an empty in-memory cache
  }
}
