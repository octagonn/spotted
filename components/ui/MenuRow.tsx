import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { colors } from "@/theme/colors";

/**
 * One option row in a bottom-sheet menu: fixed 20px icon slot + semibold
 * label. `destructive` renders red; a "Cancel" label auto-mutes to fog.
 */
export function MenuRow({
  icon,
  label,
  destructive,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 15 }}>
        <View style={{ width: 20, alignItems: "center" }}>{icon}</View>
        <Text
          style={{
            fontFamily: "Geist_600SemiBold",
            fontSize: 15,
            color: destructive ? "#EF4444" : label === "Cancel" ? colors.fog : colors.white
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Destructive-action confirm step for bottom sheets: title + explainer +
 * red confirm row + Cancel. Closes the sheet either way; `onConfirm` runs
 * after close on confirm.
 */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  confirmIcon,
  onConfirm
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  onConfirm: () => void;
}) {
  const sheet = useSheet();
  return (
    <View>
      <SheetTitle>{title}</SheetTitle>
      <Text style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10, fontSize: 13, lineHeight: 19, color: colors.silver }}>
        {body}
      </Text>
      <MenuRow
        icon={confirmIcon}
        label={confirmLabel}
        destructive
        onPress={() => {
          sheet.close();
          onConfirm();
        }}
      />
      <MenuRow icon={null} label="Cancel" onPress={() => sheet.close()} />
      <View style={{ height: 8 }} />
    </View>
  );
}
