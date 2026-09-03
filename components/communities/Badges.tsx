import { Check } from "lucide-react-native";
import { Text as RNText, View } from "react-native";

import { TENURE_LABEL } from "@/lib/communityTenure";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

/**
 * Mono uppercase micro pill in a tint of `color`. Uses a raw Text because the
 * color is data-driven (role colors) — the one place a hex reaches a label.
 */
export function PillBadge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: `${color}59`,
        backgroundColor: `${color}1F`
      }}
    >
      <RNText
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        style={{
          fontFamily: "GeistMono_500Medium",
          fontSize: 9.5,
          lineHeight: 12,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color
        }}
      >
        {label}
      </RNText>
    </View>
  );
}

/** Tenure chip: Founding is gold (achievement); Day 1 stays neutral. */
export function TenureChip({ badge }: { badge: "day1" | "founding" }) {
  return <PillBadge label={TENURE_LABEL[badge]} color={badge === "founding" ? tokens.accent.gold : colors.silver} />;
}

/** Small ✓ disc — "you're a member". */
export function MemberCheck({ size = 16 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: `${tokens.status.success}59`,
        backgroundColor: `${tokens.status.success}24`,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Check size={size * 0.56} color={tokens.status.success} strokeWidth={3} />
    </View>
  );
}
