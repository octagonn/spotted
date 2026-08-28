import { describe, expect, it } from "vitest";

import { hasMentions, splitMentions } from "../lib/mentions";

describe("splitMentions", () => {
  it("splits a caption with mentions into segments", () => {
    expect(splitMentions("Holy back day @ethan @hunter_kessler")).toEqual([
      { text: "Holy back day ", handle: null },
      { text: "@ethan", handle: "ethan" },
      { text: " ", handle: null },
      { text: "@hunter_kessler", handle: "hunter_kessler" }
    ]);
  });

  it("handles a mention at the start and punctuation after", () => {
    expect(splitMentions("@ryan crushed it!")).toEqual([
      { text: "@ryan", handle: "ryan" },
      { text: " crushed it!", handle: null }
    ]);
  });

  it("trims sentence-ending dots but keeps dotted handles", () => {
    expect(splitMentions("gg @mason.b.")).toEqual([
      { text: "gg ", handle: null },
      { text: "@mason.b", handle: "mason.b" },
      { text: ".", handle: null }
    ]);
  });

  it("does not treat emails as mentions", () => {
    expect(splitMentions("mail me at test@example.com ok")).toEqual([
      { text: "mail me at test@example.com ok", handle: null }
    ]);
  });

  it("returns one plain segment for text without mentions", () => {
    expect(splitMentions("leg day btw")).toEqual([{ text: "leg day btw", handle: null }]);
    expect(hasMentions("leg day btw")).toBe(false);
  });

  it("handles bare @ and empty handle gracefully", () => {
    expect(splitMentions("hello @ world")).toEqual([{ text: "hello @ world", handle: null }]);
  });
});
