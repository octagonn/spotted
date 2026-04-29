import { describe, expect, it } from "vitest";

import { canSeeFullViewerList, canShowPaywall, freezeTokenCap } from "@/lib/paywall";

describe("paywall gating", () => {
  it("only appears on allowed free-tier surfaces", () => {
    expect(canShowPaywall("viewer-list", "free")).toBe(true);
    expect(canShowPaywall("settings", "free")).toBe(true);
    expect(canShowPaywall("launch", "free")).toBe(false);
    expect(canShowPaywall("post-created", "free")).toBe(false);
    expect(canShowPaywall("viewer-list", "plus")).toBe(false);
  });

  it("keeps the social loop free", () => {
    expect(canSeeFullViewerList("free")).toBe(false);
    expect(canSeeFullViewerList("plus")).toBe(true);
    expect(freezeTokenCap("free")).toBe(1);
    expect(freezeTokenCap("plus")).toBe(3);
  });
});
