import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { rarityPctFor } from "@/lib/trophyRaritySeeds";

/**
 * App-wide trophy rarity. Calls the `trophy_rarity()` RPC, which returns, per
 * trophy/tier key, the percent of ALL users who hold it. We expose the live map
 * (merged over the seeds at read time by rarityPctFor). If the RPC isn't
 * available yet, we degrade silently to the seed percentages.
 *
 * Keys match the seed keys: standalone → id, stacked tier → `${id}:${value}`.
 */
type RarityRow = { trophy_id: string; pct: number };

export function useTrophyRarity() {
  const query = useQuery({
    queryKey: ["trophy-rarity"],
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc("trophy_rarity");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as RarityRow[]) {
        if (row?.trophy_id != null && typeof row.pct === "number") {
          map[row.trophy_id] = row.pct;
        }
      }
      return map;
    }
  });

  const live = query.data ?? {};
  return {
    live,
    /** Exact percent of users for a rarity key, live preferred over seed. */
    pctFor: (key: string) => rarityPctFor(key, live),
    isSeeded: Object.keys(live).length === 0,
    query
  };
}
