import palette from "./palette.json";

/**
 * Raw Spotted palette — a monochrome ramp (black → pure) plus ONE brand accent
 * (gold) and a few translucent white overlays.
 *
 * Source of truth is `theme/palette.json`; this module only adds typing. The
 * same JSON feeds `tailwind.config.js`, so `colors.fog` and the `text-fog`
 * class always describe the same pixels (see tests/theme.test.ts).
 *
 * Notes on specific values:
 * - `fog` (#909099) was raised from #71717A to meet WCAG AA (4.5:1) as
 *   body/label text on dark surfaces while staying dimmer than `silver`.
 * - `gold` (#E8B44C) is the only brand accent. Use it for PRs, milestones and
 *   important active states — never as a generic highlight.
 *
 * Prefer the semantic layer in `theme/tokens.ts` (`tokens.bg.*`,
 * `tokens.text.*`, `tokens.border.*`, `tokens.accent.*`) in screens; reach for
 * raw palette entries only when a semantic token genuinely does not fit.
 */
export const colors = palette.colors;

export type ColorToken = keyof typeof colors;
