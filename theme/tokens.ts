import { colors } from "./colors";
import palette from "./palette.json";

/**
 * Semantic design tokens — what screens should consume for surfaces, text,
 * borders and the gold accent (e.g. `tokens.bg.raised`, `tokens.text.secondary`)
 * rather than raw palette entries, so the visual language stays consistent as
 * the app grows.
 *
 * Every value here is an alias into `theme/palette.json` (via `colors`). There
 * is intentionally NO second gray ramp: `bg.base` is `ink`, `bg.raised` is
 * `charcoal`, `bg.subtle` is `iron`. (Before Spotted V2 these were the Tailwind
 * zinc-950/900/800 hexes — #09090B / #18181B / #27272A — which were 1–4 units
 * off the palette and meant the app carried two near-identical dark ramps.)
 */
export const tokens = {
  bg: {
    /** App background behind content. Most screens sit on `colors.black`; use
     *  this for full-bleed surfaces that need a hair of lift over pure black. */
    base: colors.ink,
    /** Cards, sheets, empty states. */
    raised: colors.charcoal,
    /** Placeholders, skeletons, video fallbacks, wells inside cards. */
    subtle: colors.iron,
    /** Translucent light overlay on top of media/photos. */
    overlay: colors.glass,
    /** Dark scrim behind controls that sit on media (mute buttons, chrome). */
    scrim: colors.scrim
  },
  border: {
    subtle: colors.hairline,
    default: colors.iron,
    strong: colors.slate
  },
  text: {
    primary: colors.white,
    secondary: colors.silver,
    /** WCAG AA (4.5:1) on dark surfaces — the dimmest gray allowed for text. */
    tertiary: colors.fog,
    /** Text on a white/solid-light control. */
    inverse: colors.black
  },
  accent: {
    /** ONE gold, app-wide. Never introduce another gold/yellow. */
    gold: colors.gold,
    /** Gold at 15% — tinted background behind gold icons/text. */
    goldSubtle: colors.goldSubtle
  },
  status: {
    /** Destructive actions, errors. Not a brand color. */
    danger: palette.status.danger,
    /** Confirmations. Not a brand color. */
    success: palette.status.success,
    /** The liked-heart red — a universal convention, not a brand color. */
    like: palette.status.like
  }
} as const;

/**
 * Radius scale — exactly three rectangular values. Snap every rectangular
 * `borderRadius` to one of these. Perfect circles (avatars, round buttons) and
 * fully-round pills use `radius.pill` (they're geometry, not a box corner).
 * Tailwind mirrors this as `rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-pill`.
 */
export const radius = palette.radius;

/**
 * Spacing scale on a 4pt rhythm — 4 / 8 / 12 / 16 / 24 / 32 (+ 40 / 48 for
 * structural gaps). Snap all margins/paddings here. Named steps mirror the
 * Tailwind scale (`space[2]` === `p-2` === 8).
 */
export const space = palette.space;

/**
 * Feed typography system — the ONLY text styles feed surfaces may use.
 * One family (Geist), five sizes, progressively dimmer grays via
 * tokens.text.*. No monospace for metadata; Boldonse is reserved for brand
 * display moments (the SPOTTED wordmark, milestone plate numbers).
 *
 * @deprecated (V2, Phase 2) — the same scale now exists as className variants
 * in theme/typography.ts (`username`, `body-sm`, `body-sm-strong`, `meta`,
 * `meta-strong`, `label`) consumed through components/ui/Text. Use those;
 * this object remains only for MusicChip / LikedByLine until they migrate.
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

/**
 * Lucide icon conventions. Pick a size by role, not by eye; pair it with the
 * matching stroke so small icons don't go spidery and large ones don't go bold.
 */
export const icon = {
  size: {
    /** Inline metadata (timestamps, counts, chip glyphs). */
    xs: 16,
    /** Compact controls inside rows/inputs. */
    sm: 20,
    /** Standard actions (header buttons, list trailing icons). */
    md: 24,
    /** Primary navigation (tab bar). */
    lg: 26
  },
  stroke: {
    /** ≤16px icons. */
    thin: 1.75,
    /** Default. */
    regular: 2,
    /** Emphasized / selected nav icons. */
    bold: 2.25
  }
} as const;

export type RadiusToken = keyof typeof radius;
export type SpaceToken = keyof typeof space;
export type TypeToken = keyof typeof typeScale;
