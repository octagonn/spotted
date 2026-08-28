import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { buildTrophyCatalog, setTrophyCatalog, type TrophyDefinition, type TrophyDefinitionRow } from "@/lib/trophies";
import { rarityKey } from "@/lib/trophyRaritySeeds";
import { type EarnedTrophyRow } from "@/lib/trophyServer";
import { useAuthStore } from "@/stores/auth";

export { toAchievements, toProgress } from "@/lib/trophyServer";

/** trophy_rarity_stats → live map keyed both by definition key and family:value. */
export function useTrophyRarityStats() {
  const defs = useTrophyDefinitionRows();
  const stats = useQuery({
    queryKey: ["trophy-rarity-stats"],
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("trophy_rarity_stats").select("key, pct");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) map[row.key] = Number(row.pct) || 0;
      return map;
    }
  });
  const live = useMemo(() => {
    const byKey = stats.data;
    if (!byKey) return {} as Record<string, number>;
    const out: Record<string, number> = { ...byKey, __loaded: 1 };
    for (const r of defs.data ?? []) {
      if (r.family && r.rule_type === "threshold") {
        const value = Number(r.rule_params?.value ?? 0) || 0;
        out[rarityKey(r.family, value)] = byKey[r.key] ?? 0;
      }
    }
    return out;
  }, [stats.data, defs.data]);
  return { live, query: stats };
}

export function useTrophyDefinitionRows() {
  return useQuery({
    queryKey: ["trophy-definitions"],
    enabled: isSupabaseConfigured,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<TrophyDefinitionRow[]> => {
      const { data, error } = await supabase
        .from("trophy_definitions")
        .select("id, key, category, tier, name, description, icon, rule_type, rule_params, family, sort, repeatable, active")
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TrophyDefinitionRow[];
    }
  });
}

/**
 * The client catalog (stacked families + standalones) built from the server
 * rows, with rarity stamped in. Also fills the module registry so every
 * existing consumer of TROPHIES / TROPHIES_BY_ID sees the same list.
 */
export function useTrophyCatalog() {
  const rows = useTrophyDefinitionRows();
  const { live } = useTrophyRarityStats();
  const catalog = useMemo<TrophyDefinition[]>(() => buildTrophyCatalog(rows.data ?? [], live), [rows.data, live]);
  useEffect(() => {
    if (catalog.length) setTrophyCatalog(catalog);
  }, [catalog]);
  const rowByKey = useMemo(() => new Map((rows.data ?? []).map((r) => [r.key, r])), [rows.data]);
  return { catalog, rows: rows.data ?? [], rowByKey, live, isLoading: rows.isLoading };
}

/** Earned rows for a user (RLS: self, friends, public content). */
export function useEarnedTrophies(userId?: string | null) {
  return useQuery({
    queryKey: ["user-trophies", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<EarnedTrophyRow[]> => {
      const { data, error } = await supabase
        .from("user_trophies")
        .select("trophy_id, tier, earned_at, instance_key, context, celebrated_at")
        .eq("user_id", userId as string)
        .order("earned_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as EarnedTrophyRow[];
    }
  });
}

/** Live metric values for every threshold trophy (server-computed). */
export function useTrophyProgressRows(userId?: string | null) {
  const authId = useAuthStore((s) => s.userId);
  return useQuery({
    queryKey: ["trophy-progress", userId],
    enabled: isSupabaseConfigured && Boolean(userId) && Boolean(authId),
    staleTime: 60_000,
    queryFn: async (): Promise<{ key: string; current: number; target: number }[]> => {
      const { data, error } = await supabase.rpc("trophy_progress", { p_user: userId as string });
      if (error) throw error;
      return (data ?? []).map((r) => ({ key: r.key, current: Number(r.current) || 0, target: Number(r.target) || 0 }));
    }
  });
}
