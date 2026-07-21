import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { TrophyCard } from "@/components/trophies/TrophyCard";
import { TrophyDetailSheet } from "@/components/trophies/TrophyDetailSheet";
import { TrophyUnlockModal } from "@/components/trophies/TrophyUnlockModal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Segmented } from "@/components/ui/Segmented";
import { useTrophyRarity } from "@/hooks/queries/useTrophyRarity";
import { useTrophyProgress } from "@/hooks/useTrophyProgress";
import { type EvaluatedTrophy } from "@/lib/trophies";
import { type Rarity } from "@/lib/trophyRarity";

const H_PAD = 16;
const GAP = 10;
const COLUMNS = 2;

const SORTS = ["Categories", "Rarest", "Earned"] as const;
type Sort = (typeof SORTS)[number];

/**
 * The trophy case. Default "Categories" view shows every category as a section
 * header + a 2-column grid. "Rarest" and "Earned" flatten into one sorted grid
 * (rarest = lowest hold-rate first; earned = your earned trophies first). Every
 * card opens a detail sheet; rarity comes from app-wide earn rates.
 */
export function TrophyCase() {
  const { width } = useWindowDimensions();
  const { groups } = useTrophyProgress();
  const { rarityFor } = useTrophyRarity();
  const [sort, setSort] = useState<Sort>("Categories");
  const [selected, setSelected] = useState<EvaluatedTrophy | null>(null);
  const [celebrate, setCelebrate] = useState<EvaluatedTrophy | null>(null);

  const cardWidth = Math.floor((width - H_PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const flat = useMemo<EvaluatedTrophy[]>(() => groups.flatMap((g) => g.trophies), [groups]);

  const sorted = useMemo<EvaluatedTrophy[]>(() => {
    if (sort === "Rarest") {
      return [...flat].sort((a, b) => rarityFor(a.def.id).pct - rarityFor(b.def.id).pct);
    }
    if (sort === "Earned") {
      return [...flat].sort((a, b) => {
        if (a.earned !== b.earned) return a.earned ? -1 : 1;
        return rarityFor(a.def.id).pct - rarityFor(b.def.id).pct;
      });
    }
    return flat;
    // rarityFor is derived from live data; re-sort when it changes.
  }, [flat, sort, rarityFor]);

  const rarityOf = (t: EvaluatedTrophy): Rarity => rarityFor(t.def.id);
  const open = (t: EvaluatedTrophy) => setSelected(t);

  return (
    <View style={{ paddingBottom: 12 }}>
      <Segmented options={[...SORTS]} value={sort} onChange={(v) => setSort(v as Sort)} />

      {sort === "Categories" ? (
        groups.map((group) => (
          <View key={group.category}>
            <SectionLabel>{group.label}</SectionLabel>
            <Grid trophies={group.trophies} cardWidth={cardWidth} rarityOf={rarityOf} onOpen={open} />
          </View>
        ))
      ) : (
        <Grid trophies={sorted} cardWidth={cardWidth} rarityOf={rarityOf} onOpen={open} />
      )}

      <TrophyDetailSheet
        trophy={selected}
        rarity={selected ? rarityOf(selected) : undefined}
        visible={selected !== null}
        onClose={() => setSelected(null)}
        onShare={
          selected
            ? () => {
                const t = selected;
                setSelected(null);
                setCelebrate(t);
              }
            : undefined
        }
      />

      <TrophyUnlockModal
        trophy={celebrate}
        rarity={celebrate ? rarityOf(celebrate) : undefined}
        visible={celebrate !== null}
        onClose={() => setCelebrate(null)}
      />
    </View>
  );
}

function Grid({
  trophies,
  cardWidth,
  rarityOf,
  onOpen
}: {
  trophies: EvaluatedTrophy[];
  cardWidth: number;
  rarityOf: (t: EvaluatedTrophy) => Rarity;
  onOpen: (t: EvaluatedTrophy) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: H_PAD }}>
      {trophies.map((trophy) => (
        <TrophyCard key={trophy.def.id} trophy={trophy} width={cardWidth} rarity={rarityOf(trophy)} onPress={() => onOpen(trophy)} />
      ))}
    </View>
  );
}
