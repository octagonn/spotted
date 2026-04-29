import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable as NativePressable, type PressableProps as NativePressableProps } from "react-native";

import { selectionHaptic } from "@/lib/haptics";

type PressableProps = Omit<NativePressableProps, "style"> & {
  children: ReactNode;
  className?: string;
  pressedClassName?: string;
  haptic?: boolean;
  style?: never;
};

export function Pressable({
  children,
  className,
  pressedClassName = "opacity-70",
  haptic = true,
  onPressIn,
  ...props
}: PressableProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <NativePressable
      {...props}
      className={[className, pressed ? pressedClassName : ""].filter(Boolean).join(" ")}
      onPressIn={async (event) => {
        setPressed(true);
        if (haptic) {
          await selectionHaptic();
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        props.onPressOut?.(event);
      }}
    >
      {children}
    </NativePressable>
  );
}
