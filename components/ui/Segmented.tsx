import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";
import { durations, easing } from "@/theme/motion";
import { radius, tokens } from "@/theme/tokens";

const PADDING = 3;
const BORDER = 1;
// Inner content height so the control lands at 44px total (2×BORDER + 2×PADDING).
const INNER_H = 44 - 2 * (PADDING + BORDER);

type SegmentedProps = {
  options: string[];
  value: string;
  onChange: (option: string) => void;
  /** Override the default margin (12 / 16 / 16). */
  style?: ViewStyle;
  /**
   * `solid` (default): bordered graphite track, white thumb, 44pt — a primary
   * control. `quiet`: borderless translucent track, glass thumb with white
   * text, 36pt — for secondary filters that must not compete with content
   * (feed Friends/Public).
   */
  variant?: "solid" | "quiet";
};

/**
 * Segmented control (spec §2.3) with an animated sliding thumb: 1px iron
 * border, radius 12, 3px padding, graphite bg; the white thumb glides under
 * the active option instead of snapping.
 */
export function Segmented({ options, value, onChange, style, variant = "solid" }: SegmentedProps) {
  const quiet = variant === "quiet";
  const border = quiet ? 0 : BORDER;
  const innerH = quiet ? 36 - 2 * PADDING : INNER_H;
  const [innerWidth, setInnerWidth] = useState(0);
  const activeIndex = Math.max(0, options.indexOf(value));
  const position = useSharedValue(activeIndex);

  useEffect(() => {
    position.value = withTiming(activeIndex, { duration: durations.toast, easing: easing.standard });
  }, [activeIndex, position]);

  const segmentWidth = options.length > 0 ? innerWidth / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * segmentWidth }]
  }));

  const measure = (event: LayoutChangeEvent) => {
    setInnerWidth(Math.max(0, event.nativeEvent.layout.width - 2 * (PADDING + border)));
  };

  return (
    <View
      onLayout={measure}
      style={[
        {
          flexDirection: "row",
          marginTop: 12,
          marginBottom: 16,
          marginHorizontal: 16,
          borderWidth: border,
          borderColor: tokens.border.default,
          borderRadius: radius.lg,
          padding: PADDING,
          backgroundColor: quiet ? colors.glassSoft : colors.graphite,
          overflow: "hidden"
        },
        style
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: PADDING,
              bottom: PADDING,
              left: PADDING,
              width: segmentWidth,
              borderRadius: radius.lg - PADDING,
              backgroundColor: quiet ? colors.glassStrong : tokens.text.primary
            },
            thumbStyle
          ]}
        />
      ) : null}
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={option}
            style={{ flex: 1 }}
            onPress={() => onChange(option)}
            pressScale={0.97}
            pressOpacity={on ? 1 : 0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <View
              style={{
                height: innerH,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text
                // Explicit line height + no font padding: every option's label
                // renders on the SAME baseline (the selected pill's label used
                // to sit a hair off the others).
                // One line, capped Dynamic Type. NOT `adjustsFontSizeToFit`: on
                // iOS with a larger text setting it ignored `minimumFontScale`
                // and shrank every label to a few points (friend's device).
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={{
                  width: "100%",
                  textAlign: "center",
                  paddingHorizontal: 4,
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 13,
                  lineHeight: 18,
                  includeFontPadding: false,
                  textAlignVertical: "center",
                  letterSpacing: 13 * 0.01,
                  color: quiet ? (on ? colors.white : tokens.text.tertiary) : on ? colors.black : tokens.text.secondary
                }}
              >
                {option}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
