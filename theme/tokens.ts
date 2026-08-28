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
    // Raised from #71717A → WCAG AA (4.5:1) on dark surfaces; matches colors.fog.
    tertiary: "#909099"
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

/**
 * Feed typography system — the ONLY text styles feed surfaces may use.
 * One family (Geist), five sizes, progressively dimmer grays via
 * tokens.text.*. No monospace for metadata; Boldonse is reserved for brand
 * display moments (the SPOTTED wordmark, milestone plate numbers).
 */
export const typeScale = {
  /** Usernames / interactive names — 15 Semibold. */
  username: { fontFamily: "Geist_600SemiBold", fontSize: 15, lineHeight: 20 } as const,
  /** Primary body (captions) — 15 Regular. */
  body: { fontFamily: "Geist_400Regular", fontSize: 15, lineHeight: 21 } as const,
  /** Bold inline within body (caption handle prefix). */
  bodyStrong: { fontFamily: "Geist_600SemiBold", fontSize: 15, lineHeight: 21 } as const,
  /** Secondary text — 14 Regular. */
  secondary: { fontFamily: "Geist_400Regular", fontSize: 14, lineHeight: 19 } as const,
  /** Metadata (timestamps, counts, song lines) — 13 Regular. */
  meta: { fontFamily: "Geist_400Regular", fontSize: 13, lineHeight: 18 } as const,
  /** Micro labels (chips, badges, overlays) — 12 Medium. */
  micro: { fontFamily: "Geist_500Medium", fontSize: 12, lineHeight: 16 } as const
} as const;

export type RadiusToken = keyof typeof radius;
export type SpaceToken = keyof typeof space;
export type TypeToken = keyof typeof typeScale;
