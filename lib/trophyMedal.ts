import type { TrophyMedal } from "@/lib/trophies";
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

export function medalLabel(medal?: TrophyMedal | null): string | null {
  if (!medal) return null;
  return medal.charAt(0).toUpperCase() + medal.slice(1);
}
