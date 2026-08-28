import { beforeEach, describe, expect, it, vi } from "vitest";

import { flushPendingPosts, isNetworkError } from "../lib/offlineQueue";
import { attachDailyPostExtras, publishDailyPost } from "../lib/posts";
import { usePendingPostsStore, type PendingPost } from "../stores/pendingPosts";

// Native/RN modules the queue touches — stubbed so the engine runs in node.
// (vi.mock calls are hoisted above the imports at run time.)
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  makeDirectoryAsync: vi.fn(async () => {}),
  copyAsync: vi.fn(async () => {}),
  deleteAsync: vi.fn(async () => {})
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {})
  }
}));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock("../lib/posts", () => ({
  publishDailyPost: vi.fn(),
  attachDailyPostExtras: vi.fn(async () => {})
}));
vi.mock("../lib/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn(async () => {}) }
}));
vi.mock("../stores/auth", () => ({
  useAuthStore: { getState: () => ({ userId: "user-1" }) }
}));
vi.mock("../stores/ui", () => ({
  showToast: vi.fn()
}));

function seedEntry(overrides: Partial<PendingPost> = {}): PendingPost {
  const entry: PendingPost = {
    id: "e1",
    createdAt: 1,
    input: {
      userId: "user-1",
      photoUris: ["file:///doc/pending-posts/e1-photo-0.jpg"],
      videoUri: null,
      insetUri: null,
      caption: "leg day",
      gymId: null,
      locationKind: "other",
      musicTitle: null,
      musicArtist: null,
      musicPreviewUrl: null,
      musicArtworkUrl: null,
      musicClipStart: 0
    },
    tags: [],
    photoTags: [],
    workoutId: null,
    communityIds: [],
    attempts: 0,
    status: "queued",
    ...overrides
  };
  usePendingPostsStore.getState().replaceAll([entry], true);
  return entry;
}

beforeEach(() => {
  vi.clearAllMocks();
  usePendingPostsStore.getState().replaceAll([], true);
});

describe("isNetworkError", () => {
  it("classifies connectivity failures as network errors", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
    expect(isNetworkError(new Error("fetch failed"))).toBe(true);
    expect(isNetworkError(new Error("Request timed out"))).toBe(true);
  });

  it("treats server rejections as non-network errors", () => {
    expect(isNetworkError(new Error("new row violates row-level security policy"))).toBe(false);
    expect(isNetworkError(new Error("duplicate key value"))).toBe(false);
  });
});

describe("flushPendingPosts", () => {
  it("uploads a queued post, attaches extras, and removes the entry", async () => {
    seedEntry({ tags: ["friend-1"], workoutId: "w-1" });
    vi.mocked(publishDailyPost).mockResolvedValueOnce("post-1");
    await flushPendingPosts();
    expect(publishDailyPost).toHaveBeenCalledTimes(1);
    expect(attachDailyPostExtras).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ tags: ["friend-1"], workoutId: "w-1" })
    );
    expect(usePendingPostsStore.getState().entries).toHaveLength(0);
  });

  it("re-queues on a network failure and stops the pass", async () => {
    seedEntry();
    vi.mocked(publishDailyPost).mockRejectedValueOnce(new TypeError("Network request failed"));
    await flushPendingPosts();
    const [entry] = usePendingPostsStore.getState().entries;
    expect(entry.status).toBe("queued");
    expect(entry.attempts).toBe(1);
  });

  it("marks a server rejection as failed so the strip offers retry/discard", async () => {
    seedEntry();
    vi.mocked(publishDailyPost).mockRejectedValueOnce(new Error("row violates row-level security"));
    await flushPendingPosts();
    expect(usePendingPostsStore.getState().entries[0].status).toBe("failed");
  });

  it("skips entries that belong to a different account", async () => {
    seedEntry({ input: { ...seedEntry().input, userId: "someone-else" } });
    await flushPendingPosts();
    expect(publishDailyPost).not.toHaveBeenCalled();
    expect(usePendingPostsStore.getState().entries[0].status).toBe("queued");
  });
});
