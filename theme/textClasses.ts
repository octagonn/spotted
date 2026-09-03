import palette from "./palette.json";
import { textVariants, type TextVariant } from "./typography";

// NativeWind resolves two conflicting utilities by their order in the generated
// stylesheet, NOT by their order in className. Colours are emitted in palette
// order, so `text-black` (first in the palette) always lost to a variant's
// `text-bone` — my chat bubbles rendered light-grey text on a white bubble
// (tester report 2026-09-02). When the caller passes a text colour, drop the
// variant's own colour so the override actually applies.
const COLOR_NAMES = new Set<string>([
  ...Object.keys(palette.colors).map((k) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)),
  "danger",
  "success",
  "transparent",
  "current",
  "inherit"
]);

export function isTextColorClass(cls: string): boolean {
  const named = /^text-([a-z-]+?)(?:\/\d+)?$/.exec(cls);
  if (named) return COLOR_NAMES.has(named[1]);
  return /^text-\[(#|rgb|hsl)/.test(cls);
}

const variantWithoutColor = new Map<TextVariant, string>();

/** Variant classes + caller classes, with the variant's colour dropped when the caller sets one. */
export function classesFor(variant: TextVariant, className: string | undefined): string {
  const base = textVariants[variant];
  if (!className) return base;
  if (!className.split(/\s+/).some(isTextColorClass)) return `${base} ${className}`;
  let stripped = variantWithoutColor.get(variant);
  if (stripped === undefined) {
    stripped = base
      .split(/\s+/)
      .filter((cls) => !isTextColorClass(cls))
      .join(" ");
    variantWithoutColor.set(variant, stripped);
  }
  return `${stripped} ${className}`;
}
