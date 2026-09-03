import { ChevronDown, Flame } from "lucide-react-native";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { CalendarTapHint } from "@/components/profile/CalendarTapHint";
import { PROFILE_GUTTER } from "@/components/profile/ProfileIdentity";
import { StreakCalendar } from "@/components/profile/StreakCalendar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { StreakDayMap } from "@/hooks/queries/useStreakDays";
import { durations } from "@/theme/motion";
import { icon, radius, space, tokens } from "@/theme/tokens";

type StreakCalendarSectionProps = {
  open: boolean;
  onToggle: () => void;
  days: StreakDayMap | undefined;
  createdAt?: string | null;
  onDayPress: (dateKey: string) => void;
  /** Owner only: today's rest cell taps through to cancel the rest day. */
  onRestDayPress?: () => void;
  /** Owner only: one-time coach mark under the open calendar. */
  showHint?: boolean;
};

/**
 * The one contained surface on a profile: a collapsible streak calendar.
 * Both own and other-user profiles use this exact treatment so the calendar
 * can't drift into two designs again.
 */
export function StreakCalendarSection({
  open,
  onToggle,
  days,
  createdAt,
  onDayPress,
  onRestDayPress,
  showHint = false
}: StreakCalendarSectionProps) {
  return (
    <View>
      <View
        style={{
          marginHorizontal: PROFILE_GUTTER,
          borderRadius: radius.md,
          backgroundColor: tokens.bg.raised,
          overflow: "hidden"
        }}
      >
        <Pressable
          onPress={onToggle}
          haptic="none"
          accessibilityRole="button"
          accessibilityLabel={open ? "Collapse streak calendar" : "Expand streak calendar"}
          accessibilityState={{ expanded: open }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              paddingHorizontal: space[4],
              paddingVertical: space[3]
            }}
          >
            <Flame size={14} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />
            <Text variant="meta-strong" className="flex-1 text-white">
              Streak calendar
            </Text>
            <ChevronDown
              size={icon.size.xs}
              color={tokens.text.tertiary}
              strokeWidth={icon.stroke.regular}
              style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
            />
          </View>
        </Pressable>
        {open ? (
          <Animated.View entering={FadeIn.duration(durations.color)} style={{ paddingBottom: space[3] }}>
            <StreakCalendar
              days={days ?? new Map()}
              createdAt={createdAt ?? undefined}
              onDayPress={onDayPress}
              onRestDayPress={onRestDayPress}
            />
          </Animated.View>
        ) : null}
      </View>
      {open && showHint ? (
        <View style={{ paddingHorizontal: PROFILE_GUTTER }}>
          <CalendarTapHint />
        </View>
      ) : null}
    </View>
  );
}
