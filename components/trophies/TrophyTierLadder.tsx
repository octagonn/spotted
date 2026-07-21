import { View } from "react-native";

import { TrophyTierRow } from "@/components/trophies/TrophyTierRow";
import { type LadderRow } from "@/lib/trophySelectors";
import { type TrophyDefinition } from "@/lib/trophies";

/** The full vertical tier ladder inside a stacked trophy's detail sheet. */
export function TrophyTierLadder({
  def,
  rows,
  progress
}: {
  def: TrophyDefinition;
  rows: LadderRow[];
  progress?: { current: number; target: number; unit?: string } | null;
}) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {rows.map((row) => (
        <TrophyTierRow key={row.tier.id} def={def} row={row} progress={row.isNext ? progress : null} />
      ))}
    </View>
  );
}
