import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    "addr:street"?: string;
    "addr:housenumber"?: string;
    leisure?: string;
    sport?: string;
  };
};

function parseRequest(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("invalid_body");
  }
  const lat = "lat" in body && typeof body.lat === "number" ? body.lat : null;
  const lng = "lng" in body && typeof body.lng === "number" ? body.lng : null;
  const radius = "radius_m" in body && typeof body.radius_m === "number" ? body.radius_m : 5000;
  if (lat === null || lng === null) {
    throw new Error("invalid_coordinates");
  }
  return { lat, lng, radius };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    await authenticatedUser(request);
    const { lat, lng, radius } = parseRequest(await request.json());
    // Gyms + yoga + pilates ONLY. sports_centre (parks, courts, rec centers) is
    // deliberately excluded — Foursquare (seed-gyms-fsq) is the primary/accurate
    // source; this OSM path is a fallback for areas Foursquare doesn't cover.
    const around = `(around:${radius},${lat},${lng})`;
    const query = `[out:json][timeout:25];(` +
      `node["leisure"="fitness_centre"]${around};way["leisure"="fitness_centre"]${around};` +
      `node["sport"="yoga"]${around};way["sport"="yoga"]${around};` +
      `node["sport"="pilates"]${around};way["sport"="pilates"]${around};` +
      `);out center tags;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    });
    if (!response.ok) {
      return jsonResponse({ error: "overpass_failed" }, 502);
    }
    const payload = await response.json();
    const elements: OverpassElement[] = Array.isArray(payload.elements) ? payload.elements : [];
    const rows = elements
      .map((element) => {
        const latitude = element.lat ?? element.center?.lat;
        const longitude = element.lon ?? element.center?.lon;
        const name = element.tags?.name;
        if (!latitude || !longitude || !name) {
          return null;
        }
        const street = element.tags?.["addr:street"] ?? "";
        const number = element.tags?.["addr:housenumber"] ?? "";
        const sport = element.tags?.sport;
        const category = sport === "yoga" ? "yoga" : sport === "pilates" ? "pilates" : "gym";
        return { name, latitude, longitude, address: `${number} ${street}`.trim() || null, category, source: "osm" };
      })
      .filter((row) => row !== null);
    const supabase = serviceClient();
    const { data, error } = await supabase.from("gyms").upsert(rows, { onConflict: "name,latitude,longitude" }).select("*");
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ gyms: data });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "unknown_error" }, 400);
  }
});
