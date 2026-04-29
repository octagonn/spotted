import { describe, expect, it } from "vitest";

import { reconcileSubscription } from "@/lib/subscription";

describe("subscription reconciliation", () => {
  it("downgrades expired plus state", () => {
    expect(
      reconcileSubscription(
        { tier: "plus", expiresAt: "2026-01-01T00:00:00.000Z", premiumSince: "2025-12-01T00:00:00.000Z" },
        new Date("2026-04-29T00:00:00.000Z")
      ).tier
    ).toBe("free");
  });

  it("keeps active plus state", () => {
    expect(
      reconcileSubscription(
        { tier: "plus", expiresAt: "2026-12-01T00:00:00.000Z", premiumSince: "2026-01-01T00:00:00.000Z" },
        new Date("2026-04-29T00:00:00.000Z")
      ).tier
    ).toBe("plus");
  });
});
