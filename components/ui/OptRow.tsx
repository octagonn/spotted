import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

type OptRowProps = {
  /** 24-viewBox lucide icon element — rendered silver inside the 36px tile. */
  icon: ReactNode;
  label: string;
  /** Right value, e.g. "Choose" / "None" / the chosen value. */
  value?: string;
  /** True once the user has set a value — renders it white 600. */
  isSet?: boolean;
  onPress?: () => void;
};

/**
 * Option row on the compose screen per spec §2.9: 36×36 icon tile (radius 10,
 * 1px iron border), label 600/14 bone, value 12.5 fog (white 600 when set),
 * trailing chevron; pressed bg graphite.
 */
export function OptRow({ icon, label, value, isSet, onPress }: OptRowProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      pressScale={1}
      pressOpacity={1}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
          paddingHorizontal: 18,
          backgroundColor: pressed ? colors.graphite : "transparent"
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.iron,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {icon}
        </View>
        <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.bone }}>{label}</Text>
        {value ? (
          <Text
            numberOfLines={1}
            style={{
              maxWidth: 150,
              textAlign: "right",
              fontSize: 12.5,
              fontFamily: isSet ? "Geist_600SemiBold" : "Geist_400Regular",
              color: isSet ? colors.white : colors.fog
            }}
          >
            {value}
          </Text>
        ) : null}
        <ChevronRight color={colors.silver} size={16} strokeWidth={2} />
      </View>
    </Pressable>
  );
}
