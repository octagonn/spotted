// Tailwind/NativeWind config. Colors, radii and spacing are DERIVED from
// theme/palette.json — the single source of truth shared with theme/colors.ts
// and theme/tokens.ts. Do not add hex values here; add them to the palette.
// tests/theme.test.ts fails if this file drifts from the palette.
const palette = require("./theme/palette.json");

/** Tailwind class names use kebab-case; the TS palette uses camelCase. */
const kebab = (key) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const colors = Object.fromEntries(Object.entries(palette.colors).map(([k, v]) => [kebab(k), v]));

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...colors,
        danger: palette.status.danger,
        success: palette.status.success
      },
      fontFamily: {
        display: ["Boldonse_400Regular"],
        anton: ["Anton_400Regular"],
        sans: ["Geist_400Regular"],
        sansMedium: ["Geist_500Medium"],
        sansStrong: ["Geist_600SemiBold"],
        sansBold: ["Geist_700Bold"],
        mono: ["GeistMono_400Regular"],
        monoMedium: ["GeistMono_500Medium"]
      },
      borderRadius: {
        // Canonical scale — matches `radius` in theme/tokens.ts.
        sm: `${palette.radius.sm}px`,
        md: `${palette.radius.md}px`,
        lg: `${palette.radius.lg}px`,
        pill: `${palette.radius.pill}px`,
        // LEGACY (pre-V2) aliases still referenced by ~16 call sites. Migrate
        // to sm/md/lg during each screen's redesign phase, then delete.
        spotted: "18px",
        card: "22px",
        sheet: "28px"
      },
      spacing: {
        18: "72px",
        22: "88px"
      }
    }
  }
};
