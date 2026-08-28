/**
 * Song-identity helpers. Deliberately dependency-free so they can be tested
 * without dragging the Supabase client and react-query into the test graph.
 */

/** The only fields deduping needs. MusicTrack satisfies this. */
export type DedupableTrack = {
  title: string;
  artist: string;
  previewUrl: string | null;
  explicit: boolean;
};

/** Title without the "(feat. …)" / "(Deluxe)" / "[Mixed]" release decoration. */
export function normTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identity of a SONG, as a listener means it — not of a catalogue release.
 *
 * The same recording ships as a single, an album cut, a deluxe edition and a
 * handful of remixes, each with its own iTunes trackId. Deduping on trackId
 * therefore collapses nothing a user would notice: a real search for
 * "Choosin' Texas" returned FIVE Ella Langley rows for the one song.
 */
export function songKey(track: DedupableTrack): string {
  return `${track.artist.toLowerCase().trim()}|${normTitle(track.title)}`;
}

/**
 * Collapse releases of the same song, keeping the best one.
 *
 * Best = playable (no preview means it can't be auditioned or played on a
 * post), then the plain release over a remix of the same title, then the
 * explicit original over its cleaned radio edit. Position is otherwise held, so
 * the catalogue's relevance ranking and the chart order both survive.
 */
export function dedupeTracks<T extends DedupableTrack>(tracks: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  const order: string[] = [];
  const rank = (track: T) =>
    (track.previewUrl ? 4 : 0) + (/[([]/.test(track.title) ? 0 : 2) + (track.explicit ? 1 : 0);
  for (const track of tracks) {
    const key = songKey(track);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, track);
      order.push(key);
    } else if (rank(track) > rank(existing)) {
      byKey.set(key, track);
    }
  }
  return order.map((key) => byKey.get(key) as T);
}
