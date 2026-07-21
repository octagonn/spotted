/**
 * Shared client-side fuzzy search — intent-tolerant matching for in-memory
 * lists (exercise library, local filtering). Handles:
 *  - case / diacritics / punctuation differences
 *  - word-order independence ("press bench" finds Bench Press)
 *  - prefix + substring + single-typo tokens ("bnech", "dedlift")
 *  - domain synonyms/aliases ("ohp" → Overhead Press, "rdl" → Romanian Deadlift)
 *
 * Server-side searches (people, gyms, communities) get the same treatment via
 * pg_trgm RPCs — this module is only for lists already on the client.
 */

/** Lowercase, strip diacritics, collapse punctuation to spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Damerau (OSA) edit distance ≤ max — substitutions, inserts, deletes AND
 *  adjacent transpositions ("bnech" → "bench" is one edit, not two). */
function editDistanceLte(a: string, b: string, max: number): boolean {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > max) return false;
  // Small strings only — full matrix is fine.
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n] <= max;
}

/**
 * Score how well `query` matches `target` (0 = no match). Higher is better.
 * Every query token must match some target token (prefix, substring, or typo).
 */
export function matchScore(query: string, target: string, aliases?: string[]): number {
  const q = normalize(query);
  if (!q) return 1; // empty query matches everything equally
  const targets = [normalize(target), ...(aliases ?? []).map(normalize)];

  let best = 0;
  for (const t of targets) {
    if (!t) continue;
    // Whole-string fast paths.
    if (t === q) return 100;
    if (t.startsWith(q)) best = Math.max(best, 80);
    if (t.includes(q)) best = Math.max(best, 60);

    const qTokens = q.split(" ");
    const tTokens = t.split(" ");
    let total = 0;
    let allMatched = true;
    for (const qt of qTokens) {
      let tokenBest = 0;
      for (const tt of tTokens) {
        if (tt === qt) tokenBest = Math.max(tokenBest, 10);
        else if (tt.startsWith(qt)) tokenBest = Math.max(tokenBest, 8);
        else if (tt.includes(qt) && qt.length >= 3) tokenBest = Math.max(tokenBest, 5);
        else if (qt.length >= 4 && editDistanceLte(qt, tt, qt.length >= 6 ? 2 : 1)) {
          tokenBest = Math.max(tokenBest, 4);
        }
      }
      if (tokenBest === 0) {
        allMatched = false;
        break;
      }
      total += tokenBest;
    }
    if (allMatched) best = Math.max(best, 20 + total);
  }
  return best;
}

/** Filter + rank a list by fuzzy match. Stable for equal scores. */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  getAliases?: (item: T) => string[] | undefined
): T[] {
  const q = query.trim();
  if (!q) return items;
  return items
    .map((item, index) => ({ item, index, score: matchScore(q, getText(item), getAliases?.(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

/** Gym-speak aliases for the exercise library ("semantic" lift search). */
export const LIFT_ALIASES: Record<string, string[]> = {
  "Bench Press": ["bp", "flat bench", "barbell bench"],
  "Incline Bench Press": ["incline bp", "incline barbell"],
  "Dumbbell Bench Press": ["db bench"],
  "Incline DB Press": ["incline dumbbell press"],
  "Overhead Press": ["ohp", "military press", "shoulder press", "strict press"],
  "Seated DB Press": ["seated dumbbell press", "seated shoulder press"],
  Deadlift: ["dl", "conventional deadlift"],
  "Romanian Deadlift": ["rdl", "romanian dl"],
  "Stiff-Leg Deadlift": ["sldl", "stiff leg"],
  "Sumo Deadlift": ["sumo dl"],
  "Back Squat": ["squat", "barbell squat"],
  "Front Squat": ["fs"],
  "Bulgarian Split Squat": ["bss", "split squat"],
  "Leg Press": ["sled press"],
  "Lat Pulldown": ["pulldown", "lats"],
  "Barbell Row": ["bent over row", "bor"],
  "Seated Cable Row": ["cable row", "low row"],
  "Pull-Up": ["pullup", "pull ups"],
  "Chin-Up": ["chinup", "chin ups"],
  "Push-Up": ["pushup", "push ups"],
  "Tricep Pushdown": ["pressdown", "cable pushdown"],
  "Skull Crusher": ["lying tricep extension", "french press"],
  "EZ-Bar Curl": ["ez curl"],
  "Dumbbell Curl": ["db curl", "bicep curl"],
  "Hammer Curl": ["neutral grip curl"],
  "Lateral Raise": ["side raise", "lat raise", "side delts"],
  "Rear Delt Fly": ["reverse fly", "rear delts"],
  "Face Pull": ["facepull"],
  "Hip Thrust": ["glute bridge barbell", "thrusts"],
  "Standing Calf Raise": ["calves", "calf raises"],
  "Hanging Leg Raise": ["hlr", "leg raises"],
  "Ab Wheel": ["rollout"],
  "Kettlebell Swing": ["kb swing"],
  "Farmer's Carry": ["farmers walk", "carries"],
  "Clean & Jerk": ["cj", "clean and jerk"],
  "Power Clean": ["cleans"],
  "Good Morning": ["goodmorning"],
  "Treadmill Run": ["treadmill", "run"],
  "Outdoor Run": ["running", "jog", "jogging"],
  "Incline Walk": ["12 3 30", "incline treadmill"],
  Stairmaster: ["stairs", "stair climber", "stepmill"],
  Cycling: ["bike", "spin"],
  "Assault Bike": ["air bike", "echo bike"],
  "Rowing Erg": ["rower", "row erg", "erg"],
  "Jump Rope": ["skipping"],
  "HIIT Circuit": ["hiit", "intervals"],
  Swimming: ["swim", "laps"]
};
