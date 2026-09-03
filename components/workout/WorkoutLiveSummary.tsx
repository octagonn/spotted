import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { GlassSurface } from "@/components/workout/GlassSurface";
import { colors } from "@/theme/colors";
import { radius, space } from "@/theme/tokens";

export type WorkoutTotals = { vol: number; done: number; all: number; reps: number; cardioMin: number };

type WorkoutLiveSummaryProps = {
  totals: WorkoutTotals;
  primaryLabel: string;
  /** Solid white when the primary action commits something (finish/save). */
  primaryEmphasis: boolean;
  primaryDisabled: boolean;
  onPrimary: () => void;
};

function Total({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  return (
    <View style={{ marginRight: space[4] }}>
      <Text variant="numeral">
        {value}
        {suffix ? (
          <Text variant="numeral-sm" className="text-fog">
            {suffix}
          </Text>
        ) : null}
      </Text>
      <Text variant="micro" className="mt-[2px]">
        {label}
      </Text>
    </View>
  );
}

/** Floating glass bar: live totals + the one primary action. Large, one-handed. */
export function WorkoutLiveSummary({
  totals,
  primaryLabel,
  primaryEmphasis,
  primaryDisabled,
  onPrimary
}: WorkoutLiveSummaryProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: space[4],
        right: space[4],
        bottom: insets.bottom > 0 ? insets.bottom + space[2] : space[4]
      }}
    >
      <GlassSurface radius={radius.lg}>
        <View
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], paddingVertical: space[3] }}
        >
          <Total value={totals.vol.toLocaleString()} label="Volume · lb" />
          <Total value={String(totals.done)} suffix={`/${totals.all}`} label="Sets" />
          {totals.cardioMin > 0 ? <Total value={String(totals.cardioMin)} label="Cardio" /> : null}
          <Pressable
            onPress={onPrimary}
            disabled={primaryDisabled}
            haptic={primaryEmphasis ? "impact" : "none"}
            pressScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: primaryEmphasis ? colors.white : colors.iron,
              alignItems: "center",
              justifyContent: "center",
              opacity: primaryDisabled ? 0.5 : 1
            }}
          >
            <Text variant="button" className={primaryEmphasis ? "text-black" : "text-white"} numberOfLines={1}>
              {primaryLabel}
            </Text>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
}
