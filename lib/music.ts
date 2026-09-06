import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { dedupeTracks, normTitle } from "@/lib/musicDedupe";

export { dedupeTracks, songKey } from "@/lib/musicDedupe";

/** A selectable song: metadata + Apple's 30s preview clip. No user sign-in. */
export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  /** Apple marks the track as explicit. */
  explicit: boolean;
  artistId?: string | null;
  genreId?: string | null;
  genreName?: string | null;
};

type ItunesResult = {
  trackId?: number;
  artistId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackExplicitness?: string;
  primaryGenreName?: string;
};

/** Songs shown per page as the picker is scrolled. */
export const MUSIC_PAGE_SIZE = 20;

function toTrack(r: ItunesResult, extra?: Partial<MusicTrack>): MusicTrack {
  return {
    id: String(r.trackId ?? `${r.trackName}-${r.artistName}`),
    title: r.trackName as string,
    artist: r.artistName as string,
    // 100px art is what iTunes returns; request 200px for crisp chips.
    artworkUrl: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "200x200") : null,
    previewUrl: r.previewUrl ?? null,
    explicit: r.trackExplicitness === "explicit",
    artistId: r.artistId ? String(r.artistId) : null,
    genreName: r.primaryGenreName ?? null,
    ...extra
  };
}

/** "SICKO MODE (feat. Drake)" → "sicko mode" — match clean/explicit siblings. */
/* --------------------------- catalog search --------------------------- */

/**
 * Song search via the iTunes Search API — Apple's public catalog endpoint.
 * Free, keyless, and returns a 30-second preview per track.
 *
 * Explicit recovery: since ~2024 the keyless /search endpoint silently serves
 * only "cleaned" radio edits (its documented `explicit` param is ignored). The
 * ID-based /lookup endpoint is NOT filtered, so for every cleaned result we
 * pull its artist's top songs and swap in the explicit original.
 */
export async function searchTracks(query: string): Promise<MusicTrack[]> {
  const term = query.trim();
  if (!term) return [];
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${encodeURIComponent(term)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`itunes_search_${response.status}`);
  const payload = (await response.json()) as { results?: ItunesResult[] };
  const rows = (payload.results ?? []).filter((r) => r.trackName && r.artistName);

  const artistIds = [
    ...new Set(rows.filter((r) => r.trackExplicitness === "cleaned" && r.artistId).map((r) => r.artistId as number))
  ].slice(0, 4);
  const explicitByKey = new Map<string, ItunesResult>();
  if (artistIds.length > 0) {
    const lookups = await Promise.all(
      artistIds.map((id) =>
        fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song&limit=50`)
          .then((r) => (r.ok ? (r.json() as Promise<{ results?: ItunesResult[] }>) : { results: [] }))
          .catch(() => ({ results: [] as ItunesResult[] }))
      )
    );
    for (const lookup of lookups) {
      for (const r of lookup.results ?? []) {
        if (r.trackExplicitness === "explicit" && r.trackName && r.previewUrl && r.artistId) {
          const key = `${r.artistId}:${normTitle(r.trackName)}`;
          if (!explicitByKey.has(key)) explicitByKey.set(key, r);
        }
      }
    }
  }

  const out: MusicTrack[] = [];
  for (const r of rows) {
    const sibling =
      r.trackExplicitness === "cleaned" && r.artistId
        ? explicitByKey.get(`${r.artistId}:${normTitle(r.trackName as string)}`)
        : undefined;
    out.push(toTrack(sibling ?? r));
  }
  // By song, not by release id — see dedupeTracks.
  return dedupeTracks(out);
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

/* ------------------------- cached daily catalogue ------------------------- */

/**
 * Rows written once a day by the refresh-music-chart job. Reading these means
 * the app never calls Apple's feeds itself: one cheap query per page, cached
 * on-device by the persisted query cache.
 */
type ChartRow = {
  rank: number;
  track_id: string;
  title: string;
  artist: string;
  artist_id: string | null;
  genre_id: string | null;
  genre_name: string | null;
  artwork_url: string | null;
  preview_url: string | null;
  explicit: boolean;
};

function rowToTrack(r: ChartRow): MusicTrack {
  return {
    id: r.track_id,
    title: r.title,
    artist: r.artist,
    artworkUrl: r.artwork_url,
    previewUrl: r.preview_url,
    explicit: r.explicit,
    artistId: r.artist_id,
    genreId: r.genre_id,
    genreName: r.genre_name
  };
}

/** Local "YYYY-MM-DD" — the rotation boundary is the user's own midnight. */
export function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Today's top songs, paged for infinite scroll.
 *
 * Page 0 is the head of Apple's overall chart; scrolling walks the rest and
 * then the deeper per-genre pool the daily job also caches, so the list never
 * dead-ends.
 */
export function useTopSongs() {
  return useInfiniteQuery({
    queryKey: ["music-top", localDayKey()],
    enabled: isSupabaseConfigured,
    initialPageParam: 0,
    // The key carries the local day, so it self-invalidates at midnight — which
    // is exactly how often the catalogue changes. Never marking it stale also
    // avoids the infinite-query behaviour of refetching EVERY loaded page:
    // someone who scrolled eight pages would otherwise re-request all eight.
    staleTime: Infinity,
    queryFn: async ({ pageParam }): Promise<MusicTrack[]> => {
      const page = pageParam as number;
      const from = page * MUSIC_PAGE_SIZE;
      // Pin every page to ONE chart day. The table keeps a rolling week
      // (refresh-music-chart prunes at 7 days) and this query used to order by
      // rank across ALL of them — so rank 0 of every stored day came back
      // together and the list opened with N copies of the #1 song, one per day
      // ("Choosin' Texas" five times, with five days cached). Latest stored day
      // rather than today's date: the refresh job's clock and the user's
      // timezone don't have to agree, and a real-but-stale chart beats an
      // empty sheet.
      const { data: latest, error: dayError } = await supabase
        .from("music_chart_daily")
        .select("day")
        .order("day", { ascending: false })
        .limit(1);
      if (dayError) throw dayError;
      const day = latest?.[0]?.day as string | undefined;
      if (!day) return [];
      const { data, error } = await supabase
        .from("music_chart_daily")
        .select("rank, track_id, title, artist, artist_id, genre_id, genre_name, artwork_url, preview_url, explicit")
        .eq("day", day)
        .not("preview_url", "is", null)
        .order("rank", { ascending: true })
        .range(from, from + MUSIC_PAGE_SIZE - 1);
      if (error) throw error;
      return dedupeTracks(((data ?? []) as ChartRow[]).map(rowToTrack));
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < MUSIC_PAGE_SIZE ? undefined : allPages.length
  });
}

/** How many songs the Recommended row shows. */
export const RECOMMENDED_COUNT = 5;

/**
 * "Recommended for you" — songs matching the kinds of music this user actually
 * picks, scored server-side against today's cached catalogue.
 *
 * The scoring (genre affinity + artist affinity + a small chart bonus, minus
 * anything already used, capped at two songs per artist) lives in the
 * music_recommendations SQL function, so this is a single round trip with no
 * external calls. With no history yet it falls back to today's top songs, and
 * it sharpens with every pick because the taste profile is recency-weighted.
 */
export function useRecommendedTracks() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["music-recommended", userId, localDayKey()],
    enabled: isSupabaseConfigured && Boolean(userId),
    // Day-scoped like the chart. The one thing that genuinely changes these
    // mid-day is the user picking a song, and recordMusicPick() invalidates
    // this key directly — event-driven instead of polling on a timer.
    staleTime: Infinity,
    queryFn: async (): Promise<MusicTrack[]> => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: ChartRow[] | null; error: { message: string } | null }>)("music_recommendations", {
        p_limit: RECOMMENDED_COUNT
      });
      if (error) throw error;
      return dedupeTracks((data ?? []).map(rowToTrack));
    }
  });
}

/**
 * Remember a song the user attached to a post. This is the only input
 * to the taste profile, so recommendations improve purely by using the app.
 * Best-effort: a failed write must never block posting.
 */
export async function recordMusicPick(track: MusicTrack): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = useAuthStore.getState().userId;
  if (!userId) return;
  try {
    await supabase.from("music_picks").insert({
      user_id: userId,
      track_id: track.id,
      track_name: track.title,
      artist_id: track.artistId ?? null,
      artist_name: track.artist,
      genre_id: track.genreId ?? null,
      genre_name: track.genreName ?? null
    });
    // The taste profile just moved, so the recommended row is out of date.
    void queryClient.invalidateQueries({ queryKey: ["music-recommended"] });
  } catch {
    // Taste history is a nice-to-have; never surface this.
  }
}
