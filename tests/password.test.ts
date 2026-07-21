import { describe, expect, it } from "vitest";

import { getPasswordRequirements, passwordMeetsRequirements } from "../lib/password";

describe("password requirements", () => {
  it("accepts a lightweight but useful password policy", () => {
    expect(passwordMeetsRequirements("spotted8")).toBe(true);
    expect(passwordMeetsRequirements("GymSession2026")).toBe(true);
  });

  it("requires eight characters, a letter, and a number", () => {
    expect(getPasswordRequirements("short1")).toEqual({
      longEnough: false,
      hasLetter: true,
      hasNumber: true
    });
    expect(passwordMeetsRequirements("12345678")).toBe(false);
    expect(passwordMeetsRequirements("abcdefgh")).toBe(false);
  });
});
