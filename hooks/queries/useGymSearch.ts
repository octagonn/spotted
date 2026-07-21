import { useInfiniteQuery } from "@tanstack/react-query";

import { mockGyms } from "@/lib/mockData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const GYM_PAGE_SIZE = 20;

export type GymSearchCoords = { latitude: number; longitude: number };

export type GymSearchResult = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number | null;
};

function haversineMeters(a: GymSearchCoords, b: GymSearchCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

function mockSearch(query: string, coords: GymSearchCoords | null, offset: number): GymSearchResult[] {
  const q = query.trim().toLowerCase();
  const rows = mockGyms
    .filter((gym) => !q || gym.name.toLowerCase().includes(q) || (gym.address ?? "").toLowerCase().includes(q))
    .map((gym) => ({
      id: gym.id,
      name: gym.name,
      address: gym.address,
      latitude: gym.latitude,
      longitude: gym.longitude,
      distance_meters: coords ? haversineMeters(coords, gym) : null
    }))
    .sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity) || a.name.localeCompare(b.name));
  return rows.slice(offset, offset + GYM_PAGE_SIZE);
}

/**
 * Paginated gym search via the `search_gyms` RPC: nearest-first when coords are
 * available, alphabetical otherwise, with optional name/address filtering.
 * Pass `enabled: false` until the location lookup has settled so the first
 * page is fetched exactly once with the right ordering.
 */
export function useGymSearch(query: string, coords: GymSearchCoords | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["gym-search", query.trim().toLowerCase(), coords?.latitude ?? null, coords?.longitude ?? null],
    enabled,
    initialPageParam: 0,
    staleTime: 60_000,
    queryFn: async ({ pageParam }): Promise<GymSearchResult[]> => {
      if (!isSupabaseConfigured) {
        return mockSearch(query, coords, pageParam);
      }
      const { data, error } = await supabase.rpc("search_gyms", {
        p_query: query.trim() || null,
        p_latitude: coords?.latitude ?? null,
        p_longitude: coords?.longitude ?? null,
        p_limit: GYM_PAGE_SIZE,
        p_offset: pageParam
      });
      if (error) {
        throw error;
      }
      return (data ?? []) as GymSearchResult[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < GYM_PAGE_SIZE ? undefined : allPages.length * GYM_PAGE_SIZE
  });
}

/** "0.4 MI" / "12 MI" style label; null when no location was available. */
export function formatDistance(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters)) {
    return null;
  }
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.max(10, Math.round((meters * 3.28084) / 10) * 10);
    return `${feet} FT`;
  }
  return miles >= 10 ? `${Math.round(miles)} MI` : `${miles.toFixed(1)} MI`;
}
