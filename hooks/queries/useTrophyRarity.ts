import { useQuery } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { makeRarity, SEED_RARITY, type Rarity } from "@/lib/trophyRarity";

/**
 * App-wide trophy rarity. Calls the `trophy_rarity()` RPC, which returns, per
 * trophy id, the percent of ALL users who hold it. We merge those live numbers
 * over the seed estimates so every trophy has a rarity even before its first
 * real earn is recorded. If the RPC isn't available yet (migration unapplied),
 * we degrade silently to the seeds.
 *
 * Returns a resolver `rarityFor(id)` plus the raw live map.
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
  const rarityFor = (id: string): Rarity => {
    const pct = live[id] ?? SEED_RARITY[id] ?? 50;
    return makeRarity(pct);
  };

  return { rarityFor, live, isSeeded: Object.keys(live).length === 0, query };
}
