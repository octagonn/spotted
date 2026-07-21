import { TrophyCard } from "@/components/trophies/TrophyCard";
import { TrophyGrid } from "@/components/trophies/TrophyGrid";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { type CategorySection } from "@/lib/trophySelectors";

/** A category header + its two-column grid of family/standalone cards. */
export function TrophyCategorySection({
  section,
  cardWidth,
  onOpen
}: {
  section: CategorySection;
  cardWidth: number;
  onOpen: (trophyId: string) => void;
}) {
  return (
    <>
      <SectionLabel>{section.label}</SectionLabel>
      <TrophyGrid>
        {section.cards.map((card) => (
          <TrophyCard key={card.def.id} card={card} width={cardWidth} onPress={() => onOpen(card.def.id)} />
        ))}
      </TrophyGrid>
    </>
  );
}
