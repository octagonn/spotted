import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type MapGym = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

/** Gyms already refined this session — one geocode per gym is plenty. */
// NOTE: pin coordinates are sourced from the Orange County official address
// locator (ocgis.com OC_Locator) — parcel-accurate. The old device-side Apple
// geocoder "self-heal" was removed so it can't drag county pins away.

/** Every gym (Orange County seed, ~300 rows) for the map markers. */
export function useMapGyms() {
  return useQuery({
    queryKey: ["map-gyms"],
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<MapGym[]> => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name, address, latitude, longitude")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as MapGym[];
    }
  });
}
