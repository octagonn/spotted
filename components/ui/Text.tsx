import type { ReactNode } from "react";
import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

import { classesFor } from "@/theme/textClasses";
import type { TextVariant } from "@/theme/typography";

type TextProps = Omit<NativeTextProps, "style"> & {
  variant?: TextVariant;
  className?: string;
  children: ReactNode;
  style?: never;
};

/** Display/title variants read as headings (WCAG 1.3.1 heading navigation). */
const HEADER_VARIANTS = new Set<TextVariant>([
  "display-xl",
  "display-lg",
  "display-md",
  "display-sm",
  "title",
  "screen-title"
]);

export function Text({
  variant = "body",
  className,
  children,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...props
}: TextProps) {
  // A caller's text colour replaces the variant's (see theme/textClasses.ts —
  // NativeWind would otherwise let the variant's colour win).
  const classes = classesFor(variant, className);
  const isHeader = HEADER_VARIANTS.has(variant);
  return (
    <NativeText
      className={classes}
      // Auto heading role for display/title variants (screen-reader heading nav).
      accessibilityRole={accessibilityRole ?? (isHeader ? "header" : undefined)}
      // Honor Dynamic Type (WCAG 1.4.4) — NEVER disable scaling. Body text scales
      // to 200%; large display headers cap lower so hero layouts don't shatter.
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isHeader ? 1.4 : 2)}
      {...props}
    >
      {children}
    </NativeText>
  );
}
