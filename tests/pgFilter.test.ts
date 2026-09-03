import { describe, expect, it } from "vitest";

import { isUuid, uuidFilterList, uuidFilterValue } from "@/lib/pgFilter";

const A = "4f8c7d2e-1b3a-4c5d-8e9f-0a1b2c3d4e5f";
const B = "0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D";

describe("pgFilter", () => {
  it("passes real UUIDs through unchanged", () => {
    expect(uuidFilterValue(A)).toBe(A);
    expect(uuidFilterValue(B)).toBe(B);
    expect(uuidFilterList([A, B])).toBe(`${A},${B}`);
    expect(isUuid(A)).toBe(true);
  });

  it("refuses anything that could add clauses to a PostgREST .or() string", () => {
    for (const bad of [
      "",
      "mock-user",
      `${A},status.eq.pending`,
      `${A})`,
      `and(user_id.eq.${A}`,
      "id.eq.x",
      " " + A,
      A + "\n"
    ]) {
      expect(() => uuidFilterValue(bad)).toThrow();
      expect(isUuid(bad)).toBe(false);
    }
    expect(() => uuidFilterList([A, "x"])).toThrow();
  });
});
