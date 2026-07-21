const colors = {
  black: "#000000",
  ink: "#0A0A0A",
  graphite: "#131315",
  charcoal: "#1C1C1F",
  iron: "#27272A",
  slate: "#3F3F46",
  ash: "#52525B",
  fog: "#71717A",
  silver: "#A1A1AA",
  mist: "#D4D4D8",
  bone: "#E4E4E7",
  white: "#FAFAFA",
  pure: "#FFFFFF",
  glass: "rgba(255,255,255,0.06)",
  "glass-strong": "rgba(255,255,255,0.10)",
  "glass-soft": "rgba(255,255,255,0.04)",
  "hairline": "rgba(255,255,255,0.08)",
  "hairline-strong": "rgba(255,255,255,0.14)"
};

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
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
        spotted: "18px",
        card: "22px",
        sheet: "28px",
        pill: "999px"
      },
      spacing: {
        18: "72px",
        22: "88px"
      }
    }
  }
};
