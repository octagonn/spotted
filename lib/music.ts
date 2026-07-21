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

/** Gym-anthem search terms surfaced as "Suggested" when the box is empty. */
const SUGGESTED_TERMS = [
  "Till I Collapse Eminem",
  "Sicko Mode Travis Scott",
  "HUMBLE Kendrick Lamar",
  "Stronger Kanye West",
  "Power Kanye West",
  "Run It Up",
  "Goosebumps Travis Scott",
  "X Gonna Give It To Ya DMX"
];

/** A trending/suggested set of gym songs for an empty picker. Cached 24h. */
export function useSuggestedTracks() {
  return useQuery({
    queryKey: ["suggested-tracks"],
    staleTime: 24 * 60 * 60_000,
    queryFn: async (): Promise<MusicTrack[]> => {
      const results = await Promise.all(
        SUGGESTED_TERMS.map((term) => searchTracks(term).catch(() => []))
      );
      // Take the top hit for each term, de-duped by track id.
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
