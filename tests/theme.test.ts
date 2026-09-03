import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import palette from "../theme/palette.json";
import { colors } from "../theme/colors";
import { radius, space, tokens } from "../theme/tokens";

const require = createRequire(import.meta.url);
const tailwind = require("../tailwind.config.js") as {
  theme: { extend: { colors: Record<string, string>; borderRadius: Record<string, string> } };
};

const kebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

describe("theme source of truth", () => {
  it("theme/colors.ts is the palette", () => {
    expect(colors).toEqual(palette.colors);
  });

  it("tailwind colors mirror the palette exactly (no drift, e.g. fog)", () => {
    for (const [key, value] of Object.entries(palette.colors)) {
      expect(tailwind.theme.extend.colors[kebab(key)], `tailwind color ${kebab(key)}`).toBe(value);
    }
    expect(tailwind.theme.extend.colors.fog).toBe("#909099");
    expect(tailwind.theme.extend.colors.gold).toBe("#E8B44C");
  });

  it("tailwind radii mirror the token radius scale", () => {
    for (const [key, value] of Object.entries(palette.radius)) {
      expect(tailwind.theme.extend.borderRadius[key]).toBe(`${value}px`);
    }
    expect(radius).toEqual(palette.radius);
  });

  it("semantic tokens only alias palette values (no second gray ramp)", () => {
    const paletteValues = new Set([...Object.values(palette.colors), ...Object.values(palette.status)]);
    const walk = (obj: Record<string, unknown>, path: string) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
          expect(paletteValues.has(v), `${path}.${k} = ${v} is not a palette value`).toBe(true);
        } else if (v && typeof v === "object") {
          walk(v as Record<string, unknown>, `${path}.${k}`);
        }
      }
    };
    walk(tokens as unknown as Record<string, unknown>, "tokens");
  });

  it("spacing is a 4pt rhythm", () => {
    for (const value of Object.values(space)) {
      expect(value % 4).toBe(0);
    }
  });
});
