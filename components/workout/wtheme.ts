import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * Workout builder styling — mapped onto the app's design system (zinc
 * surfaces + Geist + Boldonse display), NOT the HTML prototype's raw palette.
 * Gold stays reserved for PR moments.
 */
export const W = {
  ink: colors.black,
  card: tokens.bg.raised, // zinc-900 cards
  card2: tokens.bg.subtle, // zinc-800 pills / wells
  line: tokens.border.default, // zinc-800 hairlines
  strong: tokens.border.strong, // zinc-700
  text: tokens.text.primary,
  muted: tokens.text.secondary,
  faint: tokens.text.tertiary,
  danger: "#FF5C5C"
} as const;

/** Screen headers — bold Geist, same as the My Workouts tab (Boldonse stays
 *  reserved for auth/onboarding display moments; it also clips at tight line
 *  heights, so never use it for inline titles here). */
export const DISP = "Geist_700Bold";
/** Numerals & stats — bold Geist (the app dropped mono for metadata). */
export const NUM = "Geist_700Bold";
export const SEMI = "Geist_600SemiBold";
export const MED = "Geist_500Medium";
export const BODY = "Geist_400Regular";
