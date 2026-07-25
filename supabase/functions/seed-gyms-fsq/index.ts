import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

/**
 * Seed/refresh gyms from Foursquare Places — ONLY gyms, yoga, and pilates
 * studios. Runs a text search per term (gym/fitness/yoga/pilates) and keeps
 * only results that classify as a public gym/yoga/pilates venue; school &
 * hotel gyms, pools, tennis/country clubs, martial arts, etc. are rejected
 * (see EXCLUDE + classify()).
 *
 * Env (set as Supabase edge-function secrets):
 *   FOURSQUARE_API_KEY      required — Places API service key
 *   FSQ_ENDPOINT            default https://places-api.foursquare.com/places/search
 *                           (legacy v3: https://api.foursquare.com/v3/places/search)
 *   FSQ_API_VERSION         default 2025-06-17 (sent as X-Places-Api-Version;
 *                           ignored by legacy v3 — harmless)
 *   FSQ_AUTH_SCHEME         "bearer" (new API, default) | "raw" (legacy v3)
 *
 * Body: { lat: number, lng: number, radius_m?: number, queries?: string[] }
 */

// Text queries used to find fitness venues. Category-ID filtering isn't used
// because the live Places API taxonomy IDs are unstable across versions; each
// result is classified by its returned category names instead (see classify()).
const DEFAULT_QUERIES = ["gym", "fitness", "yoga", "pilates"];

type FsqCategory = { id?: number | string; name?: string };
type FsqPlace = {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  location?: { formatted_address?: string; address?: string };
  categories?: FsqCategory[];
};

// Foursquare tags school gyms, hotel fitness rooms, pools, tennis/country
// clubs, etc. with a category name containing "gym"/"fitness". Reject anything
// whose venue name (or category) matches these — they are not public
// gyms/yoga/pilates studios.
const EXCLUDE = /(high school|middle school|elementary|\bschool\b|college|university|\bpool\b|poolside|swim|aquatic|water polo|tennis|racquet|\bgolf\b|country club|volleyball|basketball|baseball|soccer|\bhotel\b|marriott|hilton|hyatt|courtyard|parking lot|rhythmic|martial art|\bdojo\b|karate|taekwondo|jiu.?jitsu|kung fu|\bymca\b|rec center|recreation center|senior center|physical therapy|chiropractic)/i;

/** Classify a place to gym | yoga | pilates, or null to skip it. */
function classify(place: FsqPlace): "gym" | "yoga" | "pilates" | null {
  const catNames = (place.categories ?? []).map((c) => (c.name ?? "").toLowerCase());
  const haystack = `${place.name ?? ""} ${catNames.join(" ")}`;
  if (EXCLUDE.test(haystack)) return null;
  if (catNames.some((n) => n.includes("yoga"))) return "yoga";
  if (catNames.some((n) => n.includes("pilates"))) return "pilates";
  if (catNames.some((n) => n.includes("gym") || n.includes("fitness"))) return "gym";
  return null; // climbing/dance/etc. — not wanted
}

function parseRequest(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("invalid_body");
  const b = body as Record<string, unknown>;
  const lat = typeof b.lat === "number" ? b.lat : null;
  const lng = typeof b.lng === "number" ? b.lng : null;
  const radius = typeof b.radius_m === "number" ? b.radius_m : 5000;
  const queries = Array.isArray(b.queries) && b.queries.every((q) => typeof q === "string")
    ? (b.queries as string[])
    : DEFAULT_QUERIES;
  if (lat === null || lng === null) throw new Error("invalid_coordinates");
  return { lat, lng, radius: Math.min(radius, 100000), queries };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    await authenticatedUser(request);
    const apiKey = Deno.env.get("FOURSQUARE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "missing_foursquare_api_key" }, 500);

    const endpoint = Deno.env.get("FSQ_ENDPOINT") ?? "https://places-api.foursquare.com/places/search";
    const apiVersion = Deno.env.get("FSQ_API_VERSION") ?? "2025-06-17";
    const authScheme = Deno.env.get("FSQ_AUTH_SCHEME") ?? "bearer";

    const { lat, lng, radius, queries } = parseRequest(await request.json());

    const headers: Record<string, string> = { Accept: "application/json" };
    headers["Authorization"] = authScheme === "raw" ? apiKey : `Bearer ${apiKey}`;
    if (apiVersion) headers["X-Places-Api-Version"] = apiVersion;

    // Run one text search per query term and merge (deduped by external id).
    const byId = new Map<string, FsqPlace>();
    for (const q of queries) {
      const url = new URL(endpoint);
      url.searchParams.set("query", q);
      url.searchParams.set("ll", `${lat},${lng}`);
      url.searchParams.set("radius", String(radius));
      url.searchParams.set("limit", "50");
      url.searchParams.set("fields", "fsq_place_id,name,latitude,longitude,location,categories");

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const text = await res.text();
        return jsonResponse({ error: "foursquare_failed", query: q, status: res.status, detail: text.slice(0, 400) }, 502);
      }
      const payload = await res.json();
      const results: FsqPlace[] = Array.isArray(payload.results) ? payload.results : [];
      for (const p of results) {
        const key = p.fsq_place_id ?? p.fsq_id ?? `${p.name}:${p.latitude}:${p.longitude}`;
        if (key) byId.set(key, p);
      }
    }
    const places: FsqPlace[] = [...byId.values()];

    const rows = places
      .map((p) => {
        const category = classify(p);
        if (!category) return null;
        const latitude = p.latitude ?? p.geocodes?.main?.latitude;
        const longitude = p.longitude ?? p.geocodes?.main?.longitude;
        const name = p.name;
        const externalId = p.fsq_place_id ?? p.fsq_id ?? null;
        if (!latitude || !longitude || !name) return null;
        return {
          name,
          latitude,
          longitude,
          address: p.location?.formatted_address ?? p.location?.address ?? null,
          category,
          source: "foursquare",
          external_id: externalId
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      return jsonResponse({ seeded: 0, note: "no gym/yoga/pilates venues in range" });
    }

    const supabase = serviceClient();
    // Upsert on external_id so refreshes update in place rather than duplicate.
    const { data, error } = await supabase
      .from("gyms")
      .upsert(rows, { onConflict: "external_id" })
      .select("id");
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ seeded: data?.length ?? 0, kinds: rows.reduce((acc: Record<string, number>, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}) });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
