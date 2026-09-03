import type { TrophyMedal } from "@/lib/trophies";
import { PREMIUM_RARITY_THRESHOLD } from "@/lib/trophyRaritySeeds";
import { colors } from "@/theme/colors";

/**
 * Tier visual treatment (spec §Tier system). Bronze reads as a starting
 * point, Silver as commitment, Gold lands on the app's amber accent, Diamond
 * is icy and gets a glint (see DiamondGlint) so it looks like something almost
 * nobody has.
 */
export const MEDAL_COLORS: Record<TrophyMedal, { solid: string; soft: string; border: string; text: string }> = {
  bronze: { solid: "#C47A3B", soft: "rgba(196,122,59,0.18)", border: "rgba(196,122,59,0.55)", text: "#E0A06A" },
  silver: { solid: "#C0C6CE", soft: "rgba(192,198,206,0.16)", border: "rgba(192,198,206,0.5)", text: "#DCE1E7" },
  gold: { solid: colors.gold, soft: "rgba(232,180,76,0.18)", border: "rgba(232,180,76,0.55)", text: colors.gold },
  diamond: { solid: "#9BE7FF", soft: "rgba(155,231,255,0.16)", border: "rgba(155,231,255,0.6)", text: "#C9F3FF" }
};

/** Colors for a medal, defaulting to the gold accent for non-tiered trophies. */
export function medalColors(medal?: TrophyMedal | null) {
  return MEDAL_COLORS[medal ?? "gold"];
}

/**
 * Medal derived from the rarity percentage, for trophies with no explicit
 * tier (all standalones). The diamond band IS the premium band (shared
 * constant, so the premium dot/glint and the diamond medallion can't drift):
 * sub-threshold (including "no one has this yet") reads diamond, then
 * 1-3% gold, 3-8% silver, common bronze.
 */
export function medalForRarity(rarityPct: number): TrophyMedal {
  if (rarityPct < PREMIUM_RARITY_THRESHOLD) return "diamond";
  if (rarityPct < 3) return "gold";
  if (rarityPct < 8) return "silver";
  return "bronze";
}

/** The medal to display: the explicit DB tier when set, else rarity-derived. */
export function resolveMedal(explicit: TrophyMedal | null | undefined, rarityPct: number): TrophyMedal {
  return explicit ?? medalForRarity(rarityPct);
}

export function medalLabel(medal?: TrophyMedal | null): string | null {
  if (!medal) return null;
  return medal.charAt(0).toUpperCase() + medal.slice(1);
}
