import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

type ChoiceRowProps = {
  title: string;
  sub?: string;
  /** Small badge rendered before the sub text (e.g. explicit "E"). */
  subBadge?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** Leading slot (avatar / icon tile). */
  left?: ReactNode;
  onPress?: () => void;
};

/**
 * Choice row inside sheets per spec §2.8: gap 12, padding 13×20, pressed bg
 * charcoal; disabled 0.38 opacity; trailing 22px check-ring (white fill + black
 * check when selected).
 */
export function ChoiceRow({ title, sub, subBadge, selected, disabled, left, onPress }: ChoiceRowProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      pressScale={1}
      pressOpacity={1}
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
          paddingHorizontal: 20,
          backgroundColor: pressed && !disabled ? colors.charcoal : "transparent",
          opacity: disabled ? 0.38 : 1
        }}
      >
        {left}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Geist_600SemiBold",
              fontSize: 14.5,
              color: colors.bone
            }}
          >
            {title}
          </Text>
          {sub ? (
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
              {subBadge}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: colors.fog }}>{sub}</Text>
            </View>
          ) : null}
        </View>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: selected ? colors.white : colors.slate,
            backgroundColor: selected ? colors.white : "transparent",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {selected ? <Check color={colors.black} size={11} strokeWidth={3} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
