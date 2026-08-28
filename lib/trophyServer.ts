import type { TrophyAchievement, TrophyDefinition, TrophyDefinitionRow, TrophyProgress } from "@/lib/trophies";

/** One earned row from user_trophies. */
export type EarnedTrophyRow = {
  trophy_id: string;
  tier: number | null;
  earned_at: string;
  instance_key: string;
  context: Record<string, unknown> | null;
  celebrated_at: string | null;
};

/** Map earned rows onto the client catalog's achievement shape. */
export function toAchievements(rows: EarnedTrophyRow[], rowByKey: Map<string, TrophyDefinitionRow>): TrophyAchievement[] {
  const out: TrophyAchievement[] = [];
  for (const r of rows) {
    const def = rowByKey.get(r.trophy_id);
    if (!def) continue;
    const stacked = Boolean(def.family && def.rule_type === "threshold");
    out.push({
      achievementId: r.instance_key ? `${r.trophy_id}#${r.instance_key}` : r.trophy_id,
      trophyId: stacked ? (def.family as string) : def.key,
      tierId: stacked ? Number(def.rule_params?.value ?? 0) || 0 : null,
      earnedAt: r.earned_at,
      verificationType: "automatic",
      verificationReference: null,
      context: r.context
    });
  }
  return out;
}

/**
 * Progress per client definition: for a family, the bar climbs toward the
 * first unearned tier ("23/30 days to Silver"); for a threshold standalone,
 * toward its value.
 */
export function toProgress(
  rows: { key: string; current: number; target: number }[],
  catalog: TrophyDefinition[],
  achievements: TrophyAchievement[],
  now = new Date().toISOString()
): TrophyProgress[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const earnedTiers = new Map<string, Set<number>>();
  for (const a of achievements) {
    if (a.tierId == null) continue;
    const set = earnedTiers.get(a.trophyId) ?? new Set<number>();
    set.add(a.tierId);
    earnedTiers.set(a.trophyId, set);
  }
  const out: TrophyProgress[] = [];
  for (const def of catalog) {
    if (def.type === "stacked" && def.tiers?.length) {
      const earned = earnedTiers.get(def.id) ?? new Set<number>();
      const next = def.tiers.find((t) => !earned.has(t.value));
      if (!next) continue;
      const row = byKey.get(next.id);
      if (!row) continue;
      out.push({ trophyId: def.id, currentValue: row.current, targetValue: next.value, updatedAt: now, nextTierName: next.name });
    } else if (def.trackingType === "progress") {
      const row = byKey.get(def.id);
      if (!row) continue;
      out.push({ trophyId: def.id, currentValue: row.current, targetValue: row.target, updatedAt: now });
    }
  }
  return out;
}
