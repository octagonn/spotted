import { describe, expect, it } from "vitest";

import { groupDisplayName } from "../lib/groupName";

const members = [
  { id: "a", name: "Ethan Malamatenios" },
  { id: "b", name: "Mason Beaver" },
  { id: "c", name: "Tyler S" }
];

describe("groupDisplayName", () => {
  it("uses the custom title for everyone when set", () => {
    expect(groupDisplayName("Leg Day Crew", members, "a")).toBe("Leg Day Crew");
    expect(groupDisplayName("Leg Day Crew", members, "c")).toBe("Leg Day Crew");
  });

  it("shows each viewer the OTHER members' first names", () => {
    expect(groupDisplayName(null, members, "c")).toBe("Ethan & Mason");
    expect(groupDisplayName(null, members, "a")).toBe("Mason & Tyler");
    expect(groupDisplayName(null, members, "b")).toBe("Ethan & Tyler");
  });

  it("comma-joins larger groups with a final ampersand", () => {
    const four = [...members, { id: "d", name: "Ryan K" }];
    expect(groupDisplayName(null, four, "d")).toBe("Ethan, Mason & Tyler");
  });

  it("falls back sensibly", () => {
    expect(groupDisplayName("", members, "c")).toBe("Ethan & Mason");
    expect(groupDisplayName(null, [{ id: "a", name: "Ethan M" }], "a")).toBe("Group");
    expect(groupDisplayName(null, [{ id: "a", name: "Ethan M" }], "b")).toBe("Ethan");
  });
});
