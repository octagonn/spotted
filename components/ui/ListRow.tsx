import type { ReactNode } from "react";
import { useState } from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

type ListRowProps = {
  /** Larger presentation (messages inbox): taller row, bigger name/preview. */
  big?: boolean;
  /** Leading slot — usually an <Avatar> or <GroupAvatar>. */
  left?: ReactNode;
  name: string;
  sub?: string;
  /** Emphasized sub (unread previews: mist + 600). */
  subStrong?: boolean;
  /** Right-aligned mono time, e.g. "12m". */
  time?: string;
  /** White 8px unread dot under the time. */
  unread?: boolean;
  /** Custom trailing slot (replaces time/unread column), e.g. a RelButton. */
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * List row per spec §2.5: gap 12, padding 11×18; pressed bg graphite;
 * name 600/14.5 bone, sub 12.5 fog (ellipsis), time mono 10.5 ash, 8px unread dot.
 */
export function ListRow({ big = false, left, name, sub, subStrong, time, unread, right, onPress, onLongPress }: ListRowProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
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
          gap: big ? 14 : 12,
          paddingVertical: big ? 14 : 11,
          paddingHorizontal: 18,
          backgroundColor: pressed && onPress ? colors.graphite : "transparent"
        }}
      >
        {left}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: big ? 16.5 : 14.5,
              letterSpacing: 14.5 * -0.01,
              color: colors.bone
            }}
          >
            {name}
          </Text>
          {sub ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontSize: big ? 14 : 12.5,
                fontFamily: subStrong ? "Geist_600SemiBold" : "Geist_400Regular",
                color: subStrong ? colors.mist : colors.fog
              }}
            >
              {sub}
            </Text>
          ) : null}
        </View>
        {right ?? (
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            {time ? (
              <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>{time}</Text>
            ) : null}
            {unread ? (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} />
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
