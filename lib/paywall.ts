import type { SubscriptionTier } from "@/types/domain";

export type PaywallSurface =
  | "viewer-list"
  | "travel-mode"
  | "flame-color"
  | "streak-revival"
  | "settings"
  | "day-seven-push"
  | "launch"
  | "post-created"
  | "checkin"
  | "streak-milestone";

const allowedSurfaces: PaywallSurface[] = [
  "viewer-list",
  "travel-mode",
  "flame-color",
  "streak-revival",
  "settings",
  "day-seven-push"
];

export function canShowPaywall(surface: PaywallSurface, tier: SubscriptionTier) {
  return tier === "free" && allowedSurfaces.includes(surface);
}

export function canSeeFullViewerList(tier: SubscriptionTier) {
  return tier === "plus";
}

export function freezeTokenCap(tier: SubscriptionTier) {
  return tier === "plus" ? 3 : 1;
}
