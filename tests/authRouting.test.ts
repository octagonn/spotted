import { describe, expect, it } from "vitest";

import { userNeedsPasswordSetup } from "../lib/authRouting";

describe("auth routing", () => {
  it("keeps verified users in password setup while the metadata gate is true", () => {
    expect(userNeedsPasswordSetup({ user_metadata: { password_setup_required: true } })).toBe(true);
  });

  it("allows normal routing when password setup is absent or complete", () => {
    expect(userNeedsPasswordSetup({ user_metadata: { password_setup_required: false } })).toBe(false);
    expect(userNeedsPasswordSetup({ user_metadata: {} })).toBe(false);
    expect(userNeedsPasswordSetup(null)).toBe(false);
  });
});
