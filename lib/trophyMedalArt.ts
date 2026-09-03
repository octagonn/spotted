import type { TrophyMedal } from "@/lib/trophies";

/**
 * Pre-rendered medallion artwork (512px RGBA cutouts, empty center face — see
 * assets/images/trophies/manifest.json). Earned trophies render the tier
 * medallion with the family's Lucide glyph composited on top; locked trophies
 * keep the dim line-icon silhouette — that contrast is the design.
 */
export const MEDAL_ART: Record<TrophyMedal, number> = {
  bronze: require("../assets/images/trophies/medal-bronze.png"),
  silver: require("../assets/images/trophies/medal-silver.png"),
  gold: require("../assets/images/trophies/medal-gold.png"),
  diamond: require("../assets/images/trophies/medal-diamond.png")
};

/** Compact plain-gold emblem for earned standalone (non-tiered) trophies. */
const STANDALONE_BADGE_ART: number = require("../assets/images/trophies/badge-standalone.png");

/** Medallion for an earned trophy: tier medal art, else the standalone badge. */
export function medalArt(medal?: TrophyMedal | null): number {
  return medal ? MEDAL_ART[medal] : STANDALONE_BADGE_ART;
}

/**
 * Glyph color over the medallion's metal face. Dark ink reads as engraved on
 * the bright bronze/silver/gold faces; diamond's icy face takes a deep blue.
 */
export function medalGlyphColor(medal?: TrophyMedal | null): string {
  return medal === "diamond" ? "#0E2A3D" : "rgba(24,16,4,0.78)";
}
