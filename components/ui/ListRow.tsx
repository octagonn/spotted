import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

type ListRowProps = {
  /** Larger presentation (messages inbox): taller row, bigger name/preview. */
  big?: boolean;
  /** Leading slot — usually an <Avatar> or <GroupAvatar>. */
  left?: ReactNode;
  name: string;
  sub?: string;
  /** Emphasized sub (unread previews). */
  subStrong?: boolean;
  /** Right-aligned mono time, e.g. "12m". */
  time?: string;
  /** White unread dot under the time. */
  unread?: boolean;
  /** Custom trailing slot (replaces time/unread column), e.g. a RelButton. */
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * The list row: leading slot · name + sub · trailing (time + unread, or a
 * custom control). Pressed rows tint graphite. 16pt gutter.
 */
export function ListRow({
  big = false,
  left,
  name,
  sub,
  subStrong,
  time,
  unread,
  right,
  onPress,
  onLongPress
}: ListRowProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      haptic="none"
      pressScale={1}
      pressOpacity={1}
      // Compose the whole row into one spoken name so a screen reader hears
      // "{name}, {preview}, {time}, unread" instead of scattered fragments.
      accessibilityLabel={[name, sub, time, unread ? "unread" : null].filter(Boolean).join(", ")}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingVertical: big ? space[3] : space[2] + 2,
          paddingHorizontal: space[4],
          backgroundColor: pressed && onPress ? colors.graphite : "transparent"
        }}
      >
        {left}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant={big ? "subheading" : "username"} numberOfLines={1}>
            {name}
          </Text>
          {sub ? (
            <Text
              variant={subStrong ? (big ? "body-sm-strong" : "meta-strong") : big ? "body-sm" : "meta"}
              numberOfLines={1}
              className={subStrong ? "text-mist" : big ? "text-fog" : ""}
            >
              {sub}
            </Text>
          ) : null}
        </View>
        {right ?? (
          <View style={{ alignItems: "flex-end", gap: space[1] + 2 }}>
            {time ? (
              <Text variant="mono" className="text-[11px]">
                {time}
              </Text>
            ) : null}
            {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} /> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
