import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

/**
 * Seed/refresh gyms from Foursquare Places — ONLY gyms, yoga, and pilates
 * studios. Sports parks, courts, stadiums, recreation centers, etc. are
 * excluded by querying the "Gym and Studio" category tree and then keeping only
 * results whose category name is gym/fitness/yoga/pilates.
 *
 * Env (set as Supabase edge-function secrets):
 *   FOURSQUARE_API_KEY      required — Places API service key
 *   FSQ_ENDPOINT            default https://places-api.foursquare.com/places/search
 *                           (legacy v3: https://api.foursquare.com/v3/places/search)
 *   FSQ_API_VERSION         default 2025-06-17 (sent as X-Places-Api-Version;
 *                           ignored by legacy v3 — harmless)
 *   FSQ_AUTH_SCHEME         "bearer" (new API, default) | "raw" (legacy v3)
 *
 * Body: { lat: number, lng: number, radius_m?: number }
 */

// Foursquare "Gym and Studio" parent category — narrows the search to fitness
// venues (excludes parks/stadiums/courts entirely).
const GYM_AND_STUDIO_CATEGORY = "18021";

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

/** Classify a place to gym | yoga | pilates, or null to skip it. */
function classify(categories: FsqCategory[] | undefined): "gym" | "yoga" | "pilates" | null {
  const names = (categories ?? []).map((c) => (c.name ?? "").toLowerCase());
  if (names.some((n) => n.includes("yoga"))) return "yoga";
  if (names.some((n) => n.includes("pilates"))) return "pilates";
  if (names.some((n) => n.includes("gym") || n.includes("fitness"))) return "gym";
  return null; // boxing/climbing/dance/martial-arts/etc. — not wanted
}

function parseRequest(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("invalid_body");
  const b = body as Record<string, unknown>;
  const lat = typeof b.lat === "number" ? b.lat : null;
  const lng = typeof b.lng === "number" ? b.lng : null;
  const radius = typeof b.radius_m === "number" ? b.radius_m : 5000;
  if (lat === null || lng === null) throw new Error("invalid_coordinates");
  return { lat, lng, radius: Math.min(radius, 100000) };
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

    const { lat, lng, radius } = parseRequest(await request.json());

    const url = new URL(endpoint);
    url.searchParams.set("ll", `${lat},${lng}`);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("fsq_category_ids", GYM_AND_STUDIO_CATEGORY);
    url.searchParams.set("categories", GYM_AND_STUDIO_CATEGORY); // legacy v3 param name
    url.searchParams.set("limit", "50");
    url.searchParams.set("fields", "fsq_place_id,fsq_id,name,latitude,longitude,geocodes,location,categories");

    const headers: Record<string, string> = { Accept: "application/json" };
    headers["Authorization"] = authScheme === "raw" ? apiKey : `Bearer ${apiKey}`;
    if (apiVersion) headers["X-Places-Api-Version"] = apiVersion;

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: "foursquare_failed", status: res.status, detail: text.slice(0, 400) }, 502);
    }
    const payload = await res.json();
    const places: FsqPlace[] = Array.isArray(payload.results) ? payload.results : [];

    const rows = places
      .map((p) => {
        const category = classify(p.categories);
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
