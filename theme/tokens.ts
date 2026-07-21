import { colors } from "./colors";

/**
 * Semantic design tokens — the single source of truth for surfaces, text,
 * borders, and the gold accent. Screens should consume these (e.g.
 * `tokens.bg.raised`, `tokens.text.secondary`) rather than raw palette entries
 * so the visual language stays consistent as the app grows.
 *
 * The zinc ramp below intentionally lines up with the existing `colors`
 * palette (border.default === colors.iron, border.strong === colors.slate,
 * text.* === white/silver/fog) so both layers describe the same pixels.
 */
export const tokens = {
  bg: {
    base: "#09090B", // zinc-950 — app background
    raised: "#18181B", // zinc-900 — cards, empty states
    subtle: "#27272A" // zinc-800 — placeholders, skeletons, video fallbacks
  },
  border: {
    default: "#27272A", // zinc-800
    strong: "#3F3F46" // zinc-700
  },
  text: {
    primary: "#FAFAFA",
    secondary: "#A1A1AA",
    tertiary: "#71717A"
  },
  accent: {
    // ONE gold, app-wide. Kept at the existing warm value (#E8B44C) per product
    // call — audit any new gold/yellow against this, never introduce another.
    gold: colors.gold,
    // Gold at 15% — tinted background behind gold icons/text.
    goldSubtle: "rgba(232,180,76,0.15)"
  }
} as const;

/**
 * Radius scale — exactly three rectangular values. Snap every rectangular
 * `borderRadius` to one of these. Perfect circles (avatars, round buttons) and
 * fully-round pills stay at `radius.pill` (they're geometry, not a box corner).
 */
export const radius = {
  sm: 12, // chips, pills, small buttons
  md: 16, // cards, calendar cells, buttons
  lg: 24, // large containers, segmented controls
  pill: 999 // fully-round — circles & capsules only
} as const;

/**
 * Spacing scale — 4 / 8 / 12 / 16 / 24 / 32. Snap all margins/paddings here.
 * Named steps mirror a 4pt base (`space[2]` === 8).
 */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32
} as const;

export type RadiusToken = keyof typeof radius;
export type SpaceToken = keyof typeof space;
