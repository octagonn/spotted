import { View } from "react-native";

import { Text } from "@/components/ui/Text";

/** Total steps in the sign-in → friends flow (sign-in counts as step 1). */
export const ONBOARDING_STEPS = 8;

/** The glass eyebrow pill above every auth/onboarding title. */
export function StepPill({ children }: { children: string }) {
  return (
    <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
      <Text variant="micro" className="text-mist">
        {children}
      </Text>
    </View>
  );
}

/**
 * Auth/onboarding page head: step pill · Boldonse title · one-line body.
 * This is the one place the Boldonse display scale is still used for a
 * screen title — in-app panels use `PanelHeader`.
 */
export function OnboardingHeader({
  step,
  label,
  title,
  body,
  compact = false
}: {
  /** 1-based step; renders "STEP n OF 7". Ignored when `label` is given. */
  step?: number;
  /** Custom eyebrow ("VERIFY", "RESET PASSWORD"). */
  label?: string;
  title: string;
  body?: string;
  /** Smaller title for long strings. */
  compact?: boolean;
}) {
  const eyebrow = label ?? (step ? `STEP ${step} OF ${ONBOARDING_STEPS}` : null);
  return (
    <View>
      {eyebrow ? <StepPill>{eyebrow}</StepPill> : null}
      <Text variant={compact ? "display-sm" : "display-md"} className="mt-6">
        {title}
      </Text>
      {body ? (
        <Text variant="body" className="mt-3 text-silver">
          {body}
        </Text>
      ) : null}
    </View>
  );
}
