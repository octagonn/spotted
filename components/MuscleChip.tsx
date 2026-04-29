import { Chip } from "@/components/ui/Chip";
import type { MuscleGroup } from "@/types/domain";

type MuscleChipProps = {
  muscle: MuscleGroup;
  selected?: boolean;
  onPress?: () => void;
};

export function MuscleChip({ muscle, selected, onPress }: MuscleChipProps) {
  return (
    <Chip selected={selected} onPress={onPress}>
      {muscle}
    </Chip>
  );
}
