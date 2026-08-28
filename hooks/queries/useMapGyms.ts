import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type MapGym = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: "gym" | "yoga" | "pilates" | null;
  /** Brand keys for the shared logo (see lib/gymChains). */
  chain?: string | null;
  institution?: string | null;
};

/** Viewport bounding box, in degrees. */
export type MapBounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

/** Orange County fallback center when device location is unavailable. */
const OC_CENTER = { latitude: 33.66, longitude: -117.78 };
const LON_SCALE = Math.cos((33.7 * Math.PI) / 180);

/**
 * Max gyms handed to the map. The GL map (MapLibre in a WebView) clusters and
 * renders thousands of points on the GPU, so this is a data-size guard, not a
 * render limit.
 */
export const MAP_GYM_LIMIT = 2500;

/** Nearest `limit` gyms to `center` (falls back to OC center if null). */
export function nearestGyms(
  gyms: MapGym[],
  center: { latitude: number; longitude: number } | null,
  limit = MAP_GYM_LIMIT
): MapGym[] {
  if (gyms.length <= limit) return gyms;
  const c = center ?? OC_CENTER;
  return [...gyms]
    .sort(
      (a, b) =>
        Math.hypot(a.latitude - c.latitude, (a.longitude - c.longitude) * LON_SCALE) -
        Math.hypot(b.latitude - c.latitude, (b.longitude - c.longitude) * LON_SCALE)
    )
    .slice(0, limit);
}

/** Starting viewport around a location (~±40km) before the map reports one. */
export function boundsAround(center: { latitude: number; longitude: number } | null): MapBounds {
  const c = center ?? OC_CENTER;
  return { minLat: c.latitude - 0.35, minLng: c.longitude - 0.45, maxLat: c.latitude + 0.35, maxLng: c.longitude + 0.45 };
}

/**
 * Cache tile for a viewport: expand ~30% (so small pans stay inside the tile)
 * then snap the edges outward to a 0.25° grid. Panning within ~25km keeps the
 * same query key — instant cache hit, no network, no DB load.
 */
export function snapBounds(b: MapBounds): MapBounds {
  const padLat = Math.max((b.maxLat - b.minLat) * 0.3, 0.05);
  const padLng = Math.max((b.maxLng - b.minLng) * 0.3, 0.05);
  const GRID = 0.25;
  const down = (v: number) => Math.floor(v / GRID) * GRID;
  const up = (v: number) => Math.ceil(v / GRID) * GRID;
  return {
    minLat: down(b.minLat - padLat),
    minLng: down(b.minLng - padLng),
    maxLat: up(b.maxLat + padLat),
    maxLng: up(b.maxLng + padLng)
  };
}

/**
 * Fitness venues inside the (snapped) viewport, via the gyms_in_bounds RPC —
 * the US-wide table stays server-side; the client only ever holds the region
 * it's looking at. Tiles cache for a day and persist to disk (the app's
 * persisted query cache), so relaunches paint instantly with no refetch.
 */
export function useMapGyms(bounds: MapBounds | null) {
  const tile = bounds ? snapBounds(bounds) : null;
  return useQuery({
    queryKey: ["map-gyms", tile?.minLat ?? null, tile?.minLng ?? null, tile?.maxLat ?? null, tile?.maxLng ?? null],
    enabled: isSupabaseConfigured && tile !== null,
    staleTime: 24 * 60 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
    // Keep the previous tile's pins while the next tile loads — no flicker.
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<MapGym[]> => {
      const { data, error } = await supabase.rpc("gyms_in_bounds", {
        p_min_lat: tile!.minLat,
        p_min_lng: tile!.minLng,
        p_max_lat: tile!.maxLat,
        p_max_lng: tile!.maxLng,
        p_limit: MAP_GYM_LIMIT
      });
      if (error) throw error;
      return (data ?? []) as MapGym[];
    }
  });
}
