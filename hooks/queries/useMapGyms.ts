import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type MapGym = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: "gym" | "yoga" | "pilates" | null;
};

/** Only fitness venues belong on the map — no sports parks, courts, etc. */
const MAP_CATEGORIES = ["gym", "yoga", "pilates"];

/** Orange County fallback center when device location is unavailable. */
const OC_CENTER = { latitude: 33.66, longitude: -117.78 };
const LON_SCALE = Math.cos((33.7 * Math.PI) / 180);

/**
 * Max markers handed to the native map. react-native-maps mounts every marker
 * at once (MapCanvas' stability contract), so the full ~660-gym dataset crashes
 * on zoom-out and stalls clustering. Showing the nearest N to the viewer keeps
 * it fast and stable — N well above what's ever visible at once.
 */
export const MAP_GYM_LIMIT = 250;

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

/** Gyms already refined this session — one geocode per gym is plenty. */
// NOTE: pin coordinates are sourced from the Orange County official address
// locator (ocgis.com OC_Locator) — parcel-accurate. The old device-side Apple
// geocoder "self-heal" was removed so it can't drag county pins away.

/** All fitness venues (gym/yoga/pilates) for the map; capped per-viewer via nearestGyms(). */
export function useMapGyms() {
  return useQuery({
    queryKey: ["map-gyms"],
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<MapGym[]> => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name, address, latitude, longitude, category")
        .in("category", MAP_CATEGORIES)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as MapGym[];
    }
  });
}
