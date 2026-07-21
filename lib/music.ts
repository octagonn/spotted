import { useQuery } from "@tanstack/react-query";

/** A selectable song: metadata + Apple's 30s preview clip. No user sign-in. */
export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  /** Apple marks the track as explicit. */
  explicit: boolean;
};

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackExplicitness?: string;
};

/**
 * Song search via the iTunes Search API — Apple's public catalog endpoint.
 * Free, keyless, and returns a 30-second preview MP4/M4A per track, which is
 * what plays on posts (the legally clean no-licensing-deal approach).
 */
export async function searchTracks(query: string): Promise<MusicTrack[]> {
  const term = query.trim();
  if (!term) return [];
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(term)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`itunes_search_${response.status}`);
  const payload = (await response.json()) as { results?: ItunesResult[] };
  return (payload.results ?? [])
    .filter((r) => r.trackName && r.artistName)
    .map((r) => ({
      id: String(r.trackId ?? `${r.trackName}-${r.artistName}`),
      title: r.trackName as string,
      artist: r.artistName as string,
      // 100px art is what iTunes returns; request the 200px variant for crisp chips.
      artworkUrl: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "200x200") : null,
      previewUrl: r.previewUrl ?? null,
      explicit: r.trackExplicitness === "explicit"
    }));
}

/** Fallback gym-anthem searches if the live charts feed is unreachable. */
const FALLBACK_TERMS = [
  "Till I Collapse Eminem",
  "Sicko Mode Travis Scott",
  "HUMBLE Kendrick Lamar",
  "Stronger Kanye West",
  "Power Kanye West",
  "Run It Up",
  "Goosebumps Travis Scott",
  "X Gonna Give It To Ya DMX"
];

type AppleChartEntry = { id?: string; name?: string; artistName?: string };

/**
 * TODAY's most-played songs from Apple's live charts RSS, hydrated with
 * preview clips via one batched iTunes lookup. This keeps "Suggested" current
 * instead of a frozen list of 2017 hits.
 */
async function fetchTrendingTracks(limit = 16): Promise<MusicTrack[]> {
  const rss = await fetch(
    `https://rss.marketingtools.apple.com/api/v2/us/music/most-played/${limit}/songs.json`
  );
  if (!rss.ok) throw new Error(`apple_charts_${rss.status}`);
  const feed = (await rss.json()) as { feed?: { results?: AppleChartEntry[] } };
  const ids = (feed.feed?.results ?? []).map((r) => r.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) throw new Error("apple_charts_empty");

  // One lookup call resolves every chart id to full track rows (with previews).
  const lookup = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=song`);
  if (!lookup.ok) throw new Error(`itunes_lookup_${lookup.status}`);
  const payload = (await lookup.json()) as { results?: ItunesResult[] };
  const byId = new Map<string, ItunesResult>();
  for (const r of payload.results ?? []) {
    if (r.trackId) byId.set(String(r.trackId), r);
  }
  const out: MusicTrack[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r?.trackName || !r.artistName || !r.previewUrl) continue;
    out.push({
      id,
      title: r.trackName,
      artist: r.artistName,
      artworkUrl: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "200x200") : null,
      previewUrl: r.previewUrl,
      explicit: r.trackExplicitness === "explicit"
    });
  }
  if (out.length === 0) throw new Error("apple_charts_no_previews");
  return out;
}

/** Current most-played songs for an empty picker (falls back to gym anthems). Cached 6h. */
export function useSuggestedTracks() {
  return useQuery({
    queryKey: ["suggested-tracks-v2"],
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<MusicTrack[]> => {
      try {
        return await fetchTrendingTracks();
      } catch {
        // Charts feed down — fall back to the classic anthem searches.
        const results = await Promise.all(FALLBACK_TERMS.map((term) => searchTracks(term).catch(() => [])));
        const seen = new Set<string>();
        const out: MusicTrack[] = [];
        for (const list of results) {
          const top = list.find((t) => t.previewUrl);
          if (top && !seen.has(top.id)) {
            seen.add(top.id);
            out.push(top);
          }
        }
        return out;
      }
    }
  });
}

/** Debounced-by-cache catalog search; only fires with 2+ characters. */
export function useTrackSearch(query: string) {
  const term = query.trim();
  return useQuery({
    queryKey: ["track-search", term.toLowerCase()],
    enabled: term.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: () => searchTracks(term)
  });
}
