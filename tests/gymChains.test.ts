import { describe, expect, it } from "vitest";

import { detectGymChain } from "@/lib/gymChainDetect";

describe("detectGymChain", () => {
  it("maps chain names to one slug regardless of location suffix", () => {
    expect(detectGymChain("EōS Fitness — Ladera Ranch")).toBe("eos");
    expect(detectGymChain("EoS Fitness Mission Viejo")).toBe("eos");
    expect(detectGymChain("24 Hour Fitness - Irvine Super-Sport")).toBe("24hour");
    expect(detectGymChain("LA Fitness")).toBe("lafitness");
    expect(detectGymChain("Esporta Fitness")).toBe("esporta");
    expect(detectGymChain("Planet Fitness")).toBe("planet");
    expect(detectGymChain("Crunch Fitness - Aliso Viejo")).toBe("crunch");
    expect(detectGymChain("F45 Training Laguna Niguel")).toBe("f45");
    expect(detectGymChain("Gold's Gym Venice")).toBe("golds");
  });

  it("does not match word fragments", () => {
    expect(detectGymChain("F450 Athletics")).toBeNull();
    expect(detectGymChain("Vasant Yoga")).toBeNull();
  });

  it("returns null for independents", () => {
    expect(detectGymChain("Iron Temple Barbell Club")).toBeNull();
    expect(detectGymChain(null)).toBeNull();
  });
});
