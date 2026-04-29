export const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export type Spacing = (typeof spacing)[number];
