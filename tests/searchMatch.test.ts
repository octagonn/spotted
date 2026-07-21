import { describe, expect, it } from "vitest";

import { fuzzyFilter, matchScore } from "@/lib/searchMatch";
import { LIFT_ALIASES } from "@/lib/searchMatch";
import { BASE_LIBRARY } from "@/lib/workoutLibrary";

const search = (q: string) =>
  fuzzyFilter(BASE_LIBRARY, q, (l) => l.name, (l) => LIFT_ALIASES[l.name]).map((l) => l.name);

describe("fuzzy exercise search", () => {
  it("matches exact and substring queries", () => {
    expect(search("bench")[0]).toBe("Bench Press");
    expect(search("deadlift")).toContain("Romanian Deadlift");
  });

  it("tolerates transposition typos (bnech → bench)", () => {
    expect(search("bnech")).toContain("Bench Press");
  });

  it("tolerates substitution typos (dedlift → deadlift)", () => {
    expect(search("dedlift")).toContain("Deadlift");
  });

  it("resolves gym-speak aliases", () => {
    expect(search("ohp")[0]).toBe("Overhead Press");
    expect(search("rdl")[0]).toBe("Romanian Deadlift");
  });

  it("is word-order independent", () => {
    expect(search("press bench")).toContain("Bench Press");
  });

  it("returns everything for an empty query and nothing for garbage", () => {
    expect(search("").length).toBe(BASE_LIBRARY.length);
    expect(search("zzqqxx").length).toBe(0);
  });

  it("ranks exact prefix above weaker matches", () => {
    expect(matchScore("bench", "Bench Press")).toBeGreaterThan(matchScore("bench", "Decline Bench Press"));
  });
});
