import { Flame } from "lucide-react-native";
import { View } from "react-native";

import { PROFILE_GUTTER } from "@/components/profile/ProfileIdentity";
import { Stat } from "@/components/ui/Stat";
import { Text } from "@/components/ui/Text";
import { icon, space, tokens } from "@/theme/tokens";

type ProfileStatsRowProps = {
  currentStreak: number;
  longestStreak: number;
  trophyCount: number;
  onPressStreak?: () => void;
  onPressTrophies?: () => void;
  /** Owner only: "N days — keep it alive. Post today." */
  keepAlive?: boolean;
};

/**
 * Gym streak · Longest · Trophies. Gold marks only the live streak flame —
 * the one achievement signal on this row.
 */
export function ProfileStatsRow({
  currentStreak,
  longestStreak,
  trophyCount,
  onPressStreak,
  onPressTrophies,
  keepAlive = false
}: ProfileStatsRowProps) {
  return (
    <View style={{ paddingHorizontal: PROFILE_GUTTER }}>
      <View style={{ flexDirection: "row" }}>
        <Stat
          value={currentStreak}
          unit="days"
          label="Gym streak"
          icon={<Flame size={13} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />}
          onPress={onPressStreak}
        />
        <Stat value={longestStreak} unit="days" label="Longest" />
        <Stat value={trophyCount} label={trophyCount === 1 ? "Trophy" : "Trophies"} onPress={onPressTrophies} />
      </View>
      {keepAlive ? (
        <View style={{ paddingTop: space[3] }}>
          <Text variant="label" className="text-gold text-center">
            {`${currentStreak} ${currentStreak === 1 ? "day" : "days"} — keep it alive. Post today.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
