import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/**
 * Settings-screen building blocks: gold pill toggle, hairline row with
 * title/sub + a right slot, chevron nav row, inline choice pills, and the
 * mono section label. Rows assume the screen provides its own horizontal
 * padding.
 */

export function SettingToggle({
  value,
  onToggle,
  disabled = false
}: {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={onToggle}
      haptic="selection"
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 3,
        opacity: disabled ? 0.45 : 1,
        backgroundColor: value ? tokens.accent.gold : tokens.border.default,
        alignItems: value ? "flex-end" : "flex-start"
      }}
    >
      <View
        style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? colors.black : colors.silver }}
      />
    </Pressable>
  );
}

function RowText({ title, sub, danger = false }: { title: string; sub?: string; danger?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="username" className={danger ? "text-danger" : ""}>
        {title}
      </Text>
      {sub ? (
        <Text variant="meta" className="mt-[3px]">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const ROW = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: space[3],
  paddingVertical: space[3] + 2,
  borderBottomWidth: 1,
  borderBottomColor: colors.graphite
};

export function SettingRow({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={ROW}>
      <RowText title={title} sub={sub} />
      {right}
    </View>
  );
}

export function SettingNavRow({
  title,
  sub,
  onPress,
  icon: leading,
  danger = false
}: {
  title: string;
  sub?: string;
  onPress: () => void;
  /** Optional leading icon (settings hub / profile nav rows). */
  icon?: ReactNode;
  /** Destructive rows (log out, delete) — title in `status.danger`. */
  danger?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} haptic="none" style={ROW}>
      {leading ? <View style={{ width: 24, alignItems: "center" }}>{leading}</View> : null}
      <RowText title={title} sub={sub} danger={danger} />
      <ChevronRight size={icon.size.xs + 2} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
    </Pressable>
  );
}

/** Inline 2–3 option pills inside a row's right slot (schedule visibility, check-in scope). */
export function SettingChoice<T extends string>({
  options,
  value,
  onSelect
}: {
  options: { key: T; label: string }[];
  value: T;
  onSelect: (key: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={8}
          >
            <View
              style={{
                paddingHorizontal: space[3] - 2,
                paddingVertical: space[1] + 2,
                borderRadius: radius.pill,
                backgroundColor: selected ? colors.white : "transparent",
                borderWidth: 1,
                borderColor: selected ? colors.white : tokens.border.default
              }}
            >
              <Text variant="label" className={selected ? "text-black" : "text-silver"}>
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingSectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text variant="micro" accessibilityRole="header" className="mb-1 mt-[26px] text-mist">
      {children}
    </Text>
  );
}
