import type { ReactNode } from "react";
import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

import { textVariants, type TextVariant } from "@/theme/typography";

type TextProps = Omit<NativeTextProps, "style"> & {
  variant?: TextVariant;
  className?: string;
  children: ReactNode;
  style?: never;
};

export function Text({ variant = "body", className, children, ...props }: TextProps) {
  const classes = className ? `${textVariants[variant]} ${className}` : textVariants[variant];
  return (
    <NativeText className={classes} {...props}>
      {children}
    </NativeText>
  );
}
