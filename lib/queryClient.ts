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

/**
 * Query keys that must never be persisted. Presence/search/viewer lists are
 * ephemeral; "stories" is TODAY-only daily-reset content, so persisting it
 * would paint yesterday's stories on the next day's cold start.
 *
 * "feed" IS persisted (Instagram-style offline support): gyms often have dead
 * cell service, so the last-seen posts must survive a relaunch and render with
 * no connection. expo-image's disk cache serves the media by URL string, so
 * even expired signed URLs still paint offline; the first online refetch
 * replaces both the rows and the URLs.
 */
const EPHEMERAL_KEYS = new Set([
  "stories",
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

// Several queries hold Set/Map data (streak-days, message-hides, blocked-users,
// nudges, taunts, trophy-rarity, story likes …). Plain JSON.stringify turns a
// Set/Map into "{}", so on rehydrate the consumer's .keys()/.has() blows up.
// Tag them on the way out and rebuild them on the way in so persistence is
// lossless. (Bottom-up reviver: inner entries are already revived here.)
// Namespaced sentinel + a strict shape check (exactly {__qct, v}) so a genuine
// user object that happens to carry a "type" field is never mistaken for one.
const TAG = "__qct";
function reviveSpecials(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const tagged = value as Record<string, unknown>;
    const keys = Object.keys(tagged);
    if (keys.length === 2 && TAG in tagged && "v" in tagged && Array.isArray(tagged.v)) {
      if (tagged[TAG] === "Map") return new Map(tagged.v as [unknown, unknown][]);
      if (tagged[TAG] === "Set") return new Set(tagged.v as unknown[]);
    }
  }
  return value;
}
function replaceSpecials(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { [TAG]: "Map", v: Array.from(value.entries()) };
  if (value instanceof Set) return { [TAG]: "Set", v: Array.from(value.values()) };
  return value;
}

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // v2: v1 blobs were written with lossy JSON (Set/Map → {}); a new key
  // discards them so no corrupted Set/Map data is ever rehydrated.
  key: "spotted-query-cache-v2",
  throttleTime: 2_000,
  serialize: (client) => JSON.stringify(client, replaceSpecials),
  deserialize: (cached) => JSON.parse(cached, reviveSpecials)
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

/**
 * Every cache that must refetch when a post is created or removed.
 *
 * Publishing only invalidated ["feed"], so a new post showed up in the feed but
 * NOT on your own profile: the grid, the post count and the streak calendar all
 * read ["user-posts"] / ["signed-user-posts"] / ["streak-days"], and those kept
 * serving the pre-post list. Because the cache is persisted to AsyncStorage,
 * that stale grid survived relaunches too — it only corrected itself when
 * something unrelated happened to invalidate it (a pull-to-refresh on the
 * profile, or finishing a workout). Posting is the one moment all of these are
 * known to be wrong, so they belong in a single list rather than being
 * remembered at four separate call sites.
 */
export const POST_MUTATION_KEYS = [
  "feed",
  "user-posts",
  "signed-user-posts",
  "my-latest-post",
  "streak",
  "streak-days"
] as const;

/** Invalidate everything a new/removed post affects. */
export async function invalidateAfterPostChange(client: QueryClient): Promise<void> {
  await Promise.all(POST_MUTATION_KEYS.map((key) => client.invalidateQueries({ queryKey: [key] })));
}
