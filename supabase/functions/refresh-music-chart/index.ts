// Fetch today's music catalogue ONCE for the whole app.
//
// Runs daily (pg_cron). Pulls Apple's overall top 100, plus the top songs of
// the genres that chart is made of, hydrates them into playable tracks
// (preview clip + explicit flag), and writes them to music_chart_daily.
//
// Clients then read one cheap query instead of each device calling Apple's
// feeds and a hydration lookup on every open. Search stays live against
// iTunes, because that has to be.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHART_DEPTH = 100;
/** Genres pulled beyond the overall chart, to deepen the recommendation pool. */
const GENRE_DEPTH = 4;
const GENRE_LIMIT = 25;
/** Catalogue depth per artist. */
const CATALOGUE_LIMIT = 25;
/**
 * Bootstrap artists, until the community's own picks take over. Deliberately
 * cross-genre so a new user's first recommendations are not all one sound —
 * these supply the older material the charts never carry.
 */
const SEED_ARTISTS = [
  "Eminem", "Kanye West", "Drake", "Travis Scott", "Kendrick Lamar", "50 Cent",
  "Lil Wayne", "Future", "Metallica", "AC/DC", "Linkin Park", "Rage Against the Machine",
  "Rihanna", "Beyonce", "The Weeknd", "Post Malone", "Bad Bunny", "Zach Bryan",
  "Morgan Wallen", "Luke Combs", "David Guetta", "Calvin Harris"
];

type ChartEntry = {
  id: string;
  name?: string;
  artistName?: string;
  genres?: { genreId: string; name: string }[];
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
  releaseDate?: string;
};

type Row = {
  day: string;
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
  source: string;
  release_year: number | null;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Batched /lookup — the only endpoint that returns preview urls AND explicit versions. */
async function hydrate(ids: string[]): Promise<Map<string, ItunesResult>> {
  const out = new Map<string, ItunesResult>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const res = await fetch(`https://itunes.apple.com/lookup?id=${chunk.join(",")}&entity=song`);
    if (!res.ok) continue;
    const payload = (await res.json()) as { results?: ItunesResult[] };
    for (const r of payload.results ?? []) {
      if (r.trackId) out.set(String(r.trackId), r);
    }
  }
  return out;
}

/** Release year, so the picker's depth is measurable and sortable. */
function yearOf(r: ItunesResult): number | null {
  const y = Number((r.releaseDate ?? "").slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}

/**
 * An artist's top songs — the catalogue source. Unlike the charts this reaches
 * back years, which is the only way older tracks can ever be recommended.
 */
async function artistCatalogue(artistId: string, limit = 25): Promise<ItunesResult[]> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=${limit}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { results?: (ItunesResult & { wrapperType?: string })[] };
  return (body.results ?? []).filter((r) => r.wrapperType === "track" && r.trackId && r.previewUrl);
}

/** Resolve an artist name to an Apple artist id (bootstrap seeds only). */
async function artistIdFor(name: string): Promise<string | null> {
  const res = await fetch(
    `https://itunes.apple.com/search?media=music&entity=musicArtist&limit=1&term=${encodeURIComponent(name)}`
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: { artistId?: number }[] };
  const id = body.results?.[0]?.artistId;
  return id ? String(id) : null;
}

async function genreChartIds(genreId: string, limit: number): Promise<string[]> {
  const res = await fetch(`https://itunes.apple.com/us/rss/topsongs/limit=${limit}/genre=${genreId}/json`);
  if (!res.ok) return [];
  const body = (await res.json()) as { feed?: { entry?: { id?: { attributes?: { "im:id"?: string } } }[] } };
  return (body.feed?.entry ?? [])
    .map((e) => e.id?.attributes?.["im:id"])
    .filter((id): id is string => Boolean(id));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const day = new Date().toISOString().slice(0, 10);

  // Idempotence + abuse guard: this is a daily job, so if today's catalogue is
  // already in place there is nothing to do and no reason to hit Apple again.
  const { count: existing } = await db
    .from("music_chart_daily")
    .select("*", { count: "exact", head: true })
    .eq("day", day);
  if ((existing ?? 0) > 0) {
    // No force override on purpose: with none, the worst anyone can do by
    // hitting this endpoint is get an instant no-op, so it is safe for the
    // scheduler to call it without a privileged secret. To genuinely re-run,
    // delete today's rows first.
    return json(200, { ok: true, day, skipped: "already_fresh", tracks: existing });
  }

  try {
    // ---- overall chart ----
    const rss = await fetch(
      `https://rss.marketingtools.apple.com/api/v2/us/music/most-played/${CHART_DEPTH}/songs.json`
    );
    if (!rss.ok) throw new Error(`apple_charts_${rss.status}`);
    const feed = (await rss.json()) as { feed?: { results?: ChartEntry[] } };
    const entries = (feed.feed?.results ?? []).filter((e) => e.id);
    if (entries.length === 0) throw new Error("empty_chart");

    const genreOf = new Map<string, { id: string; name: string }>();
    for (const e of entries) {
      const g = (e.genres ?? []).find((x) => x.name !== "Music");
      if (g) genreOf.set(e.id, { id: g.genreId, name: g.name });
    }

    // ---- deepen the pool with the leading genres ----
    const genreCounts = new Map<string, number>();
    for (const g of genreOf.values()) genreCounts.set(g.id, (genreCounts.get(g.id) ?? 0) + 1);
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, GENRE_DEPTH)
      .map(([id]) => id);

    const genreIdLists = await Promise.all(topGenres.map((g) => genreChartIds(g, GENRE_LIMIT).catch(() => [])));
    const genreTrackGenre = new Map<string, string>();
    genreIdLists.forEach((ids, i) => {
      for (const id of ids) if (!genreTrackGenre.has(id)) genreTrackGenre.set(id, topGenres[i]);
    });

    const chartIds = entries.map((e) => e.id);
    const extraIds = [...genreTrackGenre.keys()].filter((id) => !chartIds.includes(id));
    const hydrated = await hydrate([...chartIds, ...extraIds]);

    const rows: Row[] = [];
    entries.forEach((e, i) => {
      const r = hydrated.get(e.id);
      if (!r?.trackName || !r.artistName) return;
      const g = genreOf.get(e.id);
      rows.push({
        day,
        rank: i,
        track_id: e.id,
        title: r.trackName,
        artist: r.artistName,
        artist_id: r.artistId ? String(r.artistId) : null,
        genre_id: g?.id ?? null,
        genre_name: g?.name ?? r.primaryGenreName ?? null,
        artwork_url: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "200x200") : null,
        preview_url: r.previewUrl ?? null,
        explicit: r.trackExplicitness === "explicit",
        source: "top",
        release_year: yearOf(r)
      });
    });
    extraIds.forEach((id, i) => {
      const r = hydrated.get(id);
      if (!r?.trackName || !r.artistName) return;
      rows.push({
        day,
        rank: CHART_DEPTH + i,
        track_id: id,
        title: r.trackName,
        artist: r.artistName,
        artist_id: r.artistId ? String(r.artistId) : null,
        genre_id: genreTrackGenre.get(id) ?? null,
        genre_name: r.primaryGenreName ?? null,
        artwork_url: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "200x200") : null,
        preview_url: r.previewUrl ?? null,
        explicit: r.trackExplicitness === "explicit",
        source: "genre",
        release_year: yearOf(r)
      });
    });

    // ---- catalogue depth: artists this community picks, plus seeds ----
    const { data: communityArtists } = await db.rpc("music_community_artists", { p_limit: 40 });
    const catalogueIds = new Set<string>(
      ((communityArtists ?? []) as { artist_id: string }[]).map((a) => a.artist_id)
    );
    // Seeds fill the gap while there is little pick history to learn from.
    if (catalogueIds.size < 20) {
      const seedIds = await Promise.all(SEED_ARTISTS.map((n) => artistIdFor(n).catch(() => null)));
      for (const id of seedIds) if (id) catalogueIds.add(id);
    }

    const seen = new Set(rows.map((r) => r.track_id));
    const catalogues = await Promise.all(
      [...catalogueIds].slice(0, 45).map((id) => artistCatalogue(id, CATALOGUE_LIMIT).catch(() => []))
    );
    let catalogueRank = 1000;
    for (const songs of catalogues) {
      for (const r of songs) {
        const id = String(r.trackId);
        if (!r.trackName || !r.artistName || seen.has(id)) continue;
        seen.add(id);
        rows.push({
          day,
          rank: catalogueRank++,
          track_id: id,
          title: r.trackName,
          artist: r.artistName,
          artist_id: r.artistId ? String(r.artistId) : null,
          genre_id: null,
          genre_name: r.primaryGenreName ?? null,
          artwork_url: r.artworkUrl100 ? r.artworkUrl100.replace("100x100", "200x200") : null,
          preview_url: r.previewUrl ?? null,
          explicit: r.trackExplicitness === "explicit",
          source: "catalog",
          release_year: yearOf(r)
        });
      }
    }

    if (rows.length === 0) throw new Error("nothing_hydrated");

    const { error: upsertError } = await db
      .from("music_chart_daily")
      .upsert(rows, { onConflict: "day,track_id" });
    if (upsertError) throw new Error(`upsert: ${upsertError.message}`);

    // Keep a week of history; older days are dead weight.
    await db.from("music_chart_daily").delete().lt("day", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10));

    return json(200, {
      ok: true,
      day,
      tracks: rows.length,
      bySource: {
        top: rows.filter((r) => r.source === "top").length,
        genre: rows.filter((r) => r.source === "genre").length,
        catalog: rows.filter((r) => r.source === "catalog").length
      },
      oldest: Math.min(...rows.map((r) => r.release_year ?? 9999))
    });
  } catch (error) {
    console.error("refresh-music-chart failed:", error instanceof Error ? error.message : error);
    return json(500, { error: "refresh_failed" });
  }
});
