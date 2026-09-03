import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

export type ProfileTabItem<T extends string> = { key: T; label: string; icon: LucideIcon };

type ProfileContentTabsProps<T extends string> = {
  tabs: ProfileTabItem<T>[];
  value: T;
  onChange: (key: T) => void;
};

/**
 * Underlined content tabs above the media grid (POSTS · SPLIT · TAGGED).
 * One implementation for both profiles — they previously used two different
 * fonts for the same control.
 */
export function ProfileContentTabs<T extends string>({ tabs, value, onChange }: ProfileContentTabsProps<T>) {
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.graphite }}>
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            haptic="selection"
            style={{ flex: 1 }}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: space[1] + 2,
                paddingVertical: space[3],
                borderBottomWidth: 2,
                borderBottomColor: active ? tokens.text.primary : "transparent"
              }}
            >
              <Icon
                size={icon.size.xs}
                color={active ? tokens.text.primary : tokens.text.tertiary}
                strokeWidth={icon.stroke.regular}
              />
              <Text variant="micro" className={active ? "text-white" : "text-fog"}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
