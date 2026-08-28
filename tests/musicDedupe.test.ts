import { describe, expect, it } from "vitest";

import { dedupeTracks, songKey, type DedupableTrack } from "@/lib/musicDedupe";

type TestTrack = DedupableTrack & { id: string };

const track = (over: Partial<TestTrack> & Pick<TestTrack, "id" | "title" | "artist">): TestTrack => ({
  previewUrl: "https://audio.example/p.m4a",
  explicit: false,
  ...over
});

describe("songKey", () => {
  it("treats releases of the same recording as one song", () => {
    // Real iTunes data: the single, the album cut, and a remix.
    expect(songKey(track({ id: "1844932150", title: "Choosin' Texas", artist: "Ella Langley" }))).toBe(
      songKey(track({ id: "1869436839", title: "Choosin' Texas", artist: "Ella Langley" }))
    );
    expect(songKey(track({ id: "6792029538", title: "Choosin' Texas (Deerock Remix) [Mixed]", artist: "Ella Langley" }))).toBe(
      songKey(track({ id: "1844932150", title: "Choosin' Texas", artist: "Ella Langley" }))
    );
  });

  it("keeps a different artist's cover separate", () => {
    expect(songKey(track({ id: "a", title: "Choosin' Texas", artist: "Ella Langley" }))).not.toBe(
      songKey(track({ id: "b", title: "Choosin' Texas", artist: "KIDZ BOP Kids" }))
    );
  });

  it("ignores casing and stray spacing in the artist", () => {
    expect(songKey(track({ id: "a", title: "Be Her", artist: "  Ella Langley " }))).toBe(
      songKey(track({ id: "b", title: "Be Her", artist: "ella langley" }))
    );
  });
});

describe("dedupeTracks", () => {
  it("collapses the reported five-way duplicate into one", () => {
    const rows = [
      track({ id: "1844932150", title: "Choosin' Texas", artist: "Ella Langley" }),
      track({ id: "1869436839", title: "Choosin' Texas", artist: "Ella Langley" }),
      track({ id: "6792029538", title: "Choosin' Texas (Deerock Remix) [Mixed]", artist: "Ella Langley" }),
      track({ id: "6763094066", title: "Choosin' Texas", artist: "Ella Langley" }),
      track({ id: "6775963678", title: "Choosin' Texas (Country Night Remix) [Mixed]", artist: "Ella Langley" })
    ];
    expect(dedupeTracks(rows)).toHaveLength(1);
  });

  it("keeps every genuinely different song", () => {
    const rows = [
      track({ id: "1", title: "Choosin' Texas", artist: "Ella Langley" }),
      track({ id: "2", title: "Be Her", artist: "Ella Langley" }),
      track({ id: "3", title: "Choosin' Texas", artist: "KIDZ BOP Kids" })
    ];
    expect(dedupeTracks(rows)).toHaveLength(3);
  });

  it("preserves relevance order", () => {
    const rows = [
      track({ id: "1", title: "Be Her", artist: "Ella Langley" }),
      track({ id: "2", title: "Choosin' Texas", artist: "Ella Langley" }),
      track({ id: "3", title: "Choosin' Texas", artist: "Ella Langley" })
    ];
    expect(dedupeTracks(rows).map((t) => t.title)).toEqual(["Be Her", "Choosin' Texas"]);
  });

  it("prefers the release that can actually be played", () => {
    const rows = [
      track({ id: "silent", title: "Choosin' Texas", artist: "Ella Langley", previewUrl: null }),
      track({ id: "playable", title: "Choosin' Texas", artist: "Ella Langley" })
    ];
    expect(dedupeTracks(rows)[0].id).toBe("playable");
  });

  it("prefers the plain release over a remix of the same song", () => {
    const rows = [
      track({ id: "remix", title: "Choosin' Texas (Deerock Remix) [Mixed]", artist: "Ella Langley", explicit: true }),
      track({ id: "single", title: "Choosin' Texas", artist: "Ella Langley" })
    ];
    // Even though the remix is explicit, the canonical release wins.
    expect(dedupeTracks(rows)[0].id).toBe("single");
  });

  it("prefers the explicit original over its cleaned edit", () => {
    const rows = [
      track({ id: "clean", title: "Hell At Night", artist: "BigXthaPlug" }),
      track({ id: "explicit", title: "Hell At Night", artist: "BigXthaPlug", explicit: true })
    ];
    expect(dedupeTracks(rows)[0].id).toBe("explicit");
  });

  it("holds a position even when a later release replaces it", () => {
    const rows = [
      track({ id: "a", title: "Be Her", artist: "Ella Langley" }),
      track({ id: "silent", title: "20-20", artist: "Ella Langley", previewUrl: null }),
      track({ id: "playable", title: "20-20", artist: "Ella Langley" })
    ];
    expect(dedupeTracks(rows).map((t) => t.id)).toEqual(["a", "playable"]);
  });

  it("is a no-op on an empty list", () => {
    expect(dedupeTracks([])).toEqual([]);
  });
});
