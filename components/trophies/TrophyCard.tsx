import { StackedTrophyCard } from "@/components/trophies/StackedTrophyCard";
import { StandaloneTrophyCard } from "@/components/trophies/StandaloneTrophyCard";
import { type TrophyCardModel } from "@/lib/trophySelectors";

/** Routes a Categories-tab card to the stacked or standalone renderer. */
export function TrophyCard({ card, width, onPress }: { card: TrophyCardModel; width: number; onPress: () => void }) {
  if (card.def.type === "stacked") {
    return <StackedTrophyCard card={card} width={width} onPress={onPress} />;
  }
  return <StandaloneTrophyCard card={card} width={width} onPress={onPress} />;
}
