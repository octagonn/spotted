import { forwardRef, type ReactNode } from "react";
import { TextInput, View, type TextInputProps, type ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

type TextFieldProps = Omit<TextInputProps, "style"> & {
  /** Leading adornment (icon, "@", a mono prefix). */
  left?: ReactNode;
  /** Trailing adornment (eye toggle, counter). */
  right?: ReactNode;
  /** Helper line under the box ("You can change this once every 30 days."). */
  hint?: string;
  /** Character counter — pass `maxLength` too. */
  counter?: boolean;
  containerStyle?: ViewStyle;
};

/**
 * The one boxed input: raised fill, no border, radius 12, 46pt (grows when
 * multiline). Adornments sit inside the box; hints and counters sit under it.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { left, right, hint, counter = false, containerStyle, multiline, value, maxLength, ...input },
  ref
) {
  const showCounter = counter && typeof maxLength === "number";
  return (
    <View style={containerStyle}>
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: space[2] + 2,
          minHeight: 46,
          borderRadius: radius.sm,
          backgroundColor: tokens.bg.raised,
          paddingHorizontal: space[3] + 2
        }}
      >
        {left ? <View style={{ paddingTop: multiline ? space[3] : 0 }}>{left}</View> : null}
        <TextInput
          ref={ref}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          placeholderTextColor={tokens.text.tertiary}
          textAlignVertical={multiline ? "top" : "center"}
          {...input}
          style={{
            flex: 1,
            paddingVertical: space[3],
            minHeight: multiline ? 80 : undefined,
            fontFamily: "Geist_400Regular",
            fontSize: 15,
            color: colors.white
          }}
        />
        {right ? <View style={{ paddingTop: multiline ? space[3] : 0 }}>{right}</View> : null}
      </View>
      {hint || showCounter ? (
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3], paddingTop: space[1] + 2 }}
        >
          {hint ? (
            <Text variant="meta" className="flex-1">
              {hint}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {showCounter ? <Text variant="mono">{`${(value ?? "").length}/${maxLength}`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});
