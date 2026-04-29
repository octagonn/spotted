export const colors = {
  black: "#000000",
  ink: "#0A0A0A",
  graphite: "#141416",
  charcoal: "#1F1F22",
  iron: "#27272A",
  slate: "#3F3F46",
  ash: "#52525B",
  fog: "#71717A",
  silver: "#A1A1AA",
  mist: "#D4D4D8",
  bone: "#E4E4E7",
  white: "#FAFAFA",
  pure: "#FFFFFF"
} as const;

export type ColorToken = keyof typeof colors;
