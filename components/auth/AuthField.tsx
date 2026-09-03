import { Check, Circle, Eye, EyeOff, LockKeyhole } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

type AuthFieldProps = Omit<TextInputProps, "style"> & {
  /** Leading glyph (Mail, LockKeyhole, ShieldCheck…). */
  icon?: ReactNode;
  /** Trailing control (eye toggle). */
  right?: ReactNode;
  /** Input text classes; the field supplies color + size. */
  inputClassName?: string;
};

/**
 * Glass pill input for the auth/onboarding flow (sits over the video
 * background, so it stays translucent — not the raised `ui/TextField`).
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { icon: leading, right, inputClassName, ...input },
  ref
) {
  return (
    <View className="rounded-pill border border-hairline-strong bg-glass-soft px-4 py-3">
      <View className="flex-row items-center gap-3">
        {leading}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.fog}
          {...input}
          className={`flex-1 font-sans text-[16px] text-white ${inputClassName ?? ""}`}
        />
        {right}
      </View>
    </View>
  );
});

type PasswordFieldProps = Omit<AuthFieldProps, "icon" | "right" | "secureTextEntry"> & {
  visible: boolean;
  onToggleVisible: () => void;
  /** Accessible name for the eye toggle ("password" → "Show password"). */
  what?: string;
};

/** Password pill: lock glyph · secure input · eye toggle. */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { visible, onToggleVisible, what = "password", ...input },
  ref
) {
  return (
    <AuthField
      ref={ref}
      icon={<LockKeyhole color={colors.fog} size={icon.size.xs + 2} />}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={!visible}
      maxLength={72}
      {...input}
      right={
        <Pressable
          haptic="none"
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${what}` : `Show ${what}`}
          onPress={onToggleVisible}
        >
          {visible ? (
            <EyeOff color={colors.fog} size={icon.size.xs + 2} />
          ) : (
            <Eye color={colors.fog} size={icon.size.xs + 2} />
          )}
        </Pressable>
      }
    />
  );
});

/** One password rule, ticked when met. */
export function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${met ? "met" : "not met"}`}
      className="flex-row items-center gap-1.5"
    >
      {met ? <Check color={colors.white} size={14} /> : <Circle color={colors.fog} size={12} />}
      <Text variant="micro" className={met ? "text-white" : "text-fog"}>
        {label}
      </Text>
    </View>
  );
}

/** The three password rules, from `getPasswordRequirements`. */
export function PasswordRequirements({
  requirements
}: {
  requirements: { longEnough: boolean; hasLetter: boolean; hasNumber: boolean };
}) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-2 px-1 pt-1">
      <Requirement met={requirements.longEnough} label="8+ CHARACTERS" />
      <Requirement met={requirements.hasLetter} label="ONE LETTER" />
      <Requirement met={requirements.hasNumber} label="ONE NUMBER" />
    </View>
  );
}
