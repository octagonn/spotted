import { View } from "react-native";

/** Two-column trophy grid — the locked layout foundation, reused by both tabs. */
export const TROPHY_GRID = { hPad: 16, gap: 10, columns: 2 };

export function trophyCardWidth(screenWidth: number): number {
  const { hPad, gap, columns } = TROPHY_GRID;
  return Math.floor((screenWidth - hPad * 2 - gap * (columns - 1)) / columns);
}

export function TrophyGrid({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: TROPHY_GRID.gap, paddingHorizontal: TROPHY_GRID.hPad }}>
      {children}
    </View>
  );
}
