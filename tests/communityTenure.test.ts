import { describe, expect, it } from "vitest";

import { tenureBadge } from "@/lib/communityTenure";

const launch = "2026-08-01T15:30:00Z";

describe("community tenure badges", () => {
  it("marks launch-day joins as Day 1 (same UTC date, either side of creation time)", () => {
    expect(tenureBadge("2026-08-01T15:31:00Z", launch)).toBe("day1");
    expect(tenureBadge("2026-08-01T23:59:00Z", launch)).toBe("day1");
    expect(tenureBadge("2026-08-01T02:00:00Z", launch)).toBe("day1");
  });

  it("marks the first 30 days as Founding", () => {
    expect(tenureBadge("2026-08-02T00:00:00Z", launch)).toBe("founding");
    expect(tenureBadge("2026-08-30T15:00:00Z", launch)).toBe("founding");
  });

  it("gives nothing after the founding window", () => {
    expect(tenureBadge("2026-08-31T16:00:00Z", launch)).toBeNull();
    expect(tenureBadge("2027-01-01T00:00:00Z", launch)).toBeNull();
  });

  it("is null on missing or garbage input", () => {
    expect(tenureBadge(null, launch)).toBeNull();
    expect(tenureBadge("2026-08-02T00:00:00Z", undefined)).toBeNull();
    expect(tenureBadge("not a date", launch)).toBeNull();
  });
});
