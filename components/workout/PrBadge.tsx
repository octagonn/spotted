import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { tokens } from "@/theme/tokens";

/** Gold "PR" / "2 PRs" tag — the one place gold appears on a workout row. */
export function PrBadge({ count }: { count?: number }) {
  const label = count && count > 1 ? `${count} PRs` : count === 1 ? "1 PR" : "PR";
  return (
    <View style={{ backgroundColor: tokens.accent.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text variant="micro" className="text-black text-[9px] leading-[11px]">
        {label}
      </Text>
    </View>
  );
}
