import { describe, expect, it } from "vitest";

import { classesFor, isTextColorClass } from "../theme/textClasses";
import { textVariants } from "../theme/typography";

describe("Text colour overrides", () => {
  it("recognises colour utilities but not size/alignment ones", () => {
    for (const cls of ["text-black", "text-bone", "text-white", "text-black/60", "text-gold-soft", "text-danger", "text-[#123456]"]) {
      expect(isTextColorClass(cls), cls).toBe(true);
    }
    for (const cls of ["text-[15px]", "text-center", "text-left", "text-xs", "text-[10px]", "tracking-[0.6px]", "pt-3"]) {
      expect(isTextColorClass(cls), cls).toBe(false);
    }
  });

  it("drops the variant colour when the caller sets one (chat bubble: black on white)", () => {
    const classes = classesFor("body-sm", "text-black").split(" ");
    expect(classes).toContain("text-black");
    expect(classes).not.toContain("text-bone");
    expect(classes).toContain("text-[15px]");
  });

  it("keeps the variant colour when the caller sets none", () => {
    expect(classesFor("body-sm", undefined)).toBe(textVariants["body-sm"]);
    expect(classesFor("body-sm", "pt-2 text-center")).toBe(`${textVariants["body-sm"]} pt-2 text-center`);
  });

  it("every variant declares exactly one colour", () => {
    for (const [name, value] of Object.entries(textVariants)) {
      expect(value.split(" ").filter(isTextColorClass), name).toHaveLength(1);
    }
  });
});
