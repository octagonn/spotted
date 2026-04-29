import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/theme/colors";
import { Text } from "@/components/ui/Text";
import { Pressable } from "@/components/ui/Pressable";

type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-white border-white",
  ghost: "bg-ink border-iron",
  danger: "bg-graphite border-slate"
};

const textVariants: Record<ButtonVariant, string> = {
  primary: "text-black",
  ghost: "text-white",
  danger: "text-bone"
};

export function Button({ children, onPress, variant = "primary", disabled, loading, icon, className }: ButtonProps) {
  return (
    <Pressable
      className={[
        "min-h-12 flex-row items-center justify-center gap-2 rounded-spotted border px-5",
        variants[variant],
        disabled ? "opacity-40" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      onPress={onPress}
    >
      {loading ? <ActivityIndicator color={variant === "primary" ? colors.black : colors.white} /> : null}
      {!loading && icon ? <View>{icon}</View> : null}
      <Text variant="button" className={textVariants[variant]}>
        {children}
      </Text>
    </Pressable>
  );
}
