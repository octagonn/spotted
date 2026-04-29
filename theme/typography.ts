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
  italic: "font-sans text-[17px] leading-[26px] italic text-silver"
} as const;

export type TextVariant = keyof typeof textVariants;
