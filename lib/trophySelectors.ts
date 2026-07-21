/**
 * Trophy selectors — shape the achievement/progress data into the exact view
 * models the two tabs render:
 *   - Categories: ONE card per family (stacked shows the current ladder rung),
 *     grouped under category headers in CATEGORY_ORDER.
 *   - Earned: a flat list where every earned tier is its own entry, newest first.
 * Rarity everywhere is the exact percent of users who earned that trophy/tier.
 */

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TROPHIES,
  TROPHIES_BY_ID,
  tierRarityPct,
  type TrophyAchievement,
  type TrophyCategory,
  type TrophyDefinition,
  type TrophyProgress,
  type TrophyTier
} from "@/lib/trophies";

export type TrophyCardModel = {
  def: TrophyDefinition;
  earned: boolean;
  earnedTierCount: number;
  totalTiers: number;
  /** Highest earned tier name, else first-locked tier name, else the trophy name. */
  displayName: string;
  displayTier: TrophyTier | null;
  /** "3/9" for stacked, null for standalone. */
  tierPosition: string | null;
  /** Percent of users who earned the exact displayed trophy/tier. */
  rarityPct: number;
  /** Short requirement shown on locked cards. */
  requirement: string | null;
  earnedAt: string | null;
  /** Only present for "progress" trophies (streaks, weekend, home turf, nomad). */
  progress: { current: number; target: number; unit?: string } | null;
};

export type EarnedEntry = {
  key: string;
  def: TrophyDefinition;
  tier: TrophyTier | null;
  displayName: string;
  familyName: string | null;
  icon: string;
  earnedAt: string;
  rarityPct: number;
};

export type CategorySection = { category: TrophyCategory; label: string; cards: TrophyCardModel[] };

type Ctx = {
  achByTrophy: Map<string, TrophyAchievement[]>;
  progressByTrophy: Map<string, TrophyProgress>;
  live?: Record<string, number>;
};

function buildCtx(achievements: TrophyAchievement[], progress: TrophyProgress[], live?: Record<string, number>): Ctx {
  const achByTrophy = new Map<string, TrophyAchievement[]>();
  for (const a of achievements) {
    const list = achByTrophy.get(a.trophyId) ?? [];
    list.push(a);
    achByTrophy.set(a.trophyId, list);
  }
  const progressByTrophy = new Map(progress.map((p) => [p.trophyId, p]));
  return { achByTrophy, progressByTrophy, live };
}

/** The card model for a single family/standalone (Categories tab). */
export function cardModel(def: TrophyDefinition, ctx: Ctx): TrophyCardModel {
  const earnedRecords = ctx.achByTrophy.get(def.id) ?? [];
  const showProgress = def.trackingType === "progress";
  const prog = ctx.progressByTrophy.get(def.id);

  if (def.type === "stacked" && def.tiers) {
    const earnedValues = new Set(earnedRecords.map((r) => r.tierId));
    const earnedTierCount = def.tiers.filter((t) => earnedValues.has(t.value)).length;
    const highest = earnedTierCount > 0 ? def.tiers[earnedTierCount - 1] : null;
    const display = highest ?? def.tiers[0];
    const record = highest ? earnedRecords.find((r) => r.tierId === highest.value) : undefined;
    return {
      def,
      earned: earnedTierCount > 0,
      earnedTierCount,
      totalTiers: def.tiers.length,
      displayName: highest ? highest.name : def.tiers[0].name,
      displayTier: display,
      tierPosition: `${earnedTierCount}/${def.tiers.length}`,
      rarityPct: tierRarityPct(def.id, display.value, ctx.live),
      requirement: highest ? null : def.tiers[0].requirement,
      earnedAt: record?.earnedAt ?? null,
      progress: showProgress && prog ? { current: prog.currentValue, target: prog.targetValue, unit: def.unit } : null
    };
  }

  // Standalone
  const record = earnedRecords[0];
  return {
    def,
    earned: Boolean(record),
    earnedTierCount: record ? 1 : 0,
    totalTiers: 1,
    displayName: def.name,
    displayTier: null,
    tierPosition: null,
    rarityPct: tierRarityPct(def.id, null, ctx.live),
    requirement: record ? null : def.requirement,
    earnedAt: record?.earnedAt ?? null,
    progress: showProgress && prog ? { current: prog.currentValue, target: prog.targetValue, unit: def.unit } : null
  };
}

/** Categories tab: sections in fixed order, one card per family. */
export function categorySections(
  achievements: TrophyAchievement[],
  progress: TrophyProgress[],
  live?: Record<string, number>
): CategorySection[] {
  const ctx = buildCtx(achievements, progress, live);
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    cards: TROPHIES.filter((t) => t.category === category).map((def) => cardModel(def, ctx))
  }));
}

/** Earned tab: every earned tier/standalone as its own entry, newest first. */
export function earnedEntries(achievements: TrophyAchievement[], live?: Record<string, number>): EarnedEntry[] {
  return achievements
    .map((a): EarnedEntry | null => {
      const def = TROPHIES_BY_ID[a.trophyId];
      if (!def) return null;
      const tier = a.tierId != null ? def.tiers?.find((t) => t.value === a.tierId) ?? null : null;
      return {
        key: a.achievementId,
        def,
        tier,
        displayName: tier ? tier.name : def.name,
        familyName: tier ? def.name : null,
        icon: def.icon,
        earnedAt: a.earnedAt,
        rarityPct: tierRarityPct(a.trophyId, a.tierId, live)
      };
    })
    .filter((e): e is EarnedEntry => e !== null)
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

/** Full tier ladder for the detail sheet, each row earned/locked with its date. */
export type LadderRow = {
  tier: TrophyTier;
  earned: boolean;
  isNext: boolean;
  earnedAt: string | null;
  rarityPct: number;
};

export function tierLadder(def: TrophyDefinition, achievements: TrophyAchievement[], live?: Record<string, number>): LadderRow[] {
  if (def.type !== "stacked" || !def.tiers) return [];
  const records = achievements.filter((a) => a.trophyId === def.id);
  const earnedValues = new Map(records.filter((r) => r.tierId != null).map((r) => [r.tierId as number, r.earnedAt]));
  const firstLockedIndex = def.tiers.findIndex((t) => !earnedValues.has(t.value));
  return def.tiers.map((tier, i) => ({
    tier,
    earned: earnedValues.has(tier.value),
    isNext: i === firstLockedIndex,
    earnedAt: earnedValues.get(tier.value) ?? null,
    rarityPct: tierRarityPct(def.id, tier.value, live)
  }));
}

/** Count of families with at least one earned tier/standalone (profile stat). */
export function earnedTrophyCount(achievements: TrophyAchievement[]): number {
  return new Set(achievements.map((a) => a.trophyId)).size;
}
