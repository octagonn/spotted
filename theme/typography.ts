export const textVariants = {
  "display-xl": "font-display text-[96px] leading-[92px] tracking-[-0.5px] text-white",
  "display-lg": "font-display text-[64px] leading-[62px] tracking-[-0.5px] text-white",
  "display-md": "font-display text-[48px] leading-[48px] tracking-[-0.25px] text-white",
  "display-sm": "font-display text-[32px] leading-[34px] tracking-[-0.2px] text-white",
  title: "font-display text-[26px] leading-[28px] tracking-[-0.1px] text-white",
  "body-xl": "font-sans text-[22px] leading-[32px] text-bone",
  body: "font-sans text-[17px] leading-[26px] text-bone",
  "body-strong": "font-sansStrong text-[17px] leading-[26px] text-white",
  caption: "font-sans text-[13px] leading-[19px] text-silver",
  micro: "font-sansMedium text-[11px] leading-[15px] uppercase tracking-[0.6px] text-fog",
  button: "font-sansStrong text-[15px] leading-[19px] text-black",
  italic: "font-sans text-[17px] leading-[26px] italic text-silver",
  mono: "font-mono text-[12px] leading-[16px] text-fog",

  /** Screen / section headings in Geist (not Boldonse) — profile name, sheet titles. */
  heading: "font-sansBold text-[20px] leading-[24px] text-white",
  /** Sub-headings and emphasized row titles — 17 Semibold. */
  subheading: "font-sansStrong text-[17px] leading-[22px] text-white",

  // ── Feed / product scale (Geist, one family, progressively dimmer grays) ──
  /** Usernames / interactive names — 15 Semibold. */
  username: "font-sansStrong text-[15px] leading-[20px] text-white",
  /** Compact body (captions, comments, rows) — 15 Regular. */
  "body-sm": "font-sans text-[15px] leading-[21px] text-bone",
  /** Bold inline within compact body (caption handle prefix, mentions). */
  "body-sm-strong": "font-sansStrong text-[15px] leading-[21px] text-white",
  /** Metadata (timestamps, counts, locations, song lines) — 13 Regular. */
  meta: "font-sans text-[13px] leading-[18px] text-fog",
  /** Emphasized metadata (counts next to icons, "Liked by" names) — 13 Medium. */
  "meta-strong": "font-sansMedium text-[13px] leading-[18px] text-silver",
  /** Small labels (chips, badges, story names) — 12 Medium, not uppercase. */
  label: "font-sansMedium text-[12px] leading-[16px] text-silver",

  // ── Numerals (Geist Mono) — workout numbers, timers, PR values, counters ──
  /** Hero numeral (finish summary volume). */
  "numeral-xl": "font-monoMedium text-[52px] leading-[56px] text-white",
  /** Large stat numeral (summary sets/reps). */
  "numeral-lg": "font-monoMedium text-[26px] leading-[30px] text-white",
  /** Standard stat numeral (live bar totals, timers). */
  numeral: "font-monoMedium text-[20px] leading-[24px] text-white",
  /** Inline numeral (set index, rest clock). */
  "numeral-sm": "font-monoMedium text-[15px] leading-[20px] text-white"
} as const;

export type TextVariant = keyof typeof textVariants;
