import { Segmented } from "@/components/ui/Segmented";

export const TROPHY_TABS = ["Categories", "Earned"] as const;
export type TrophyTab = (typeof TROPHY_TABS)[number];

/** Exactly two tabs: Categories (default) and Earned. No Rarest. */
export function TrophySegmentedControl({ value, onChange }: { value: TrophyTab; onChange: (tab: TrophyTab) => void }) {
  return <Segmented options={[...TROPHY_TABS]} value={value} onChange={(v) => onChange(v as TrophyTab)} />;
}
