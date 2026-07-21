export const colors = {
  black: "#000000",
  ink: "#0A0A0A",
  graphite: "#131315",
  charcoal: "#1C1C1F",
  iron: "#27272A",
  slate: "#3F3F46",
  ash: "#52525B",
  fog: "#71717A",
  silver: "#A1A1AA",
  mist: "#D4D4D8",
  bone: "#E4E4E7",
  white: "#FAFAFA",
  pure: "#FFFFFF",
  // Warm gold accent — used to mark milestones like the account's first day.
  gold: "#E8B44C",
  goldSoft: "rgba(232,180,76,0.18)",
  glass: "rgba(255,255,255,0.06)",
  glassStrong: "rgba(255,255,255,0.10)",
  glassSoft: "rgba(255,255,255,0.04)",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)"
} as const;

export type ColorToken = keyof typeof colors;
