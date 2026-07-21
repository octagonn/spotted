import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";
import { easing } from "@/theme/motion";

const PADDING = 3;
const BORDER = 1;

type SegmentedProps = {
  options: string[];
  value: string;
  onChange: (option: string) => void;
  /** Override the spec default margin (10px 18px 14px). */
  style?: ViewStyle;
};

/**
 * Segmented control (spec §2.3) with an animated sliding thumb: 1px iron
 * border, radius 12, 3px padding, graphite bg; the white thumb glides under
 * the active option instead of snapping.
 */
export function Segmented({ options, value, onChange, style }: SegmentedProps) {
  const [innerWidth, setInnerWidth] = useState(0);
  const activeIndex = Math.max(0, options.indexOf(value));
  const position = useSharedValue(activeIndex);

  useEffect(() => {
    position.value = withTiming(activeIndex, { duration: 220, easing: easing.standard });
  }, [activeIndex, position]);

  const segmentWidth = options.length > 0 ? innerWidth / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * segmentWidth }]
  }));

  const measure = (event: LayoutChangeEvent) => {
    setInnerWidth(Math.max(0, event.nativeEvent.layout.width - 2 * (PADDING + BORDER)));
  };

  return (
    <View
      onLayout={measure}
      style={[
        {
          flexDirection: "row",
          marginTop: 10,
          marginBottom: 14,
          marginHorizontal: 18,
          borderWidth: BORDER,
          borderColor: colors.iron,
          borderRadius: 12,
          padding: PADDING,
          backgroundColor: colors.graphite,
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
              borderRadius: 9,
              backgroundColor: colors.white
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
                paddingVertical: 9,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist_600SemiBold",
                  fontSize: 13,
                  letterSpacing: 13 * 0.01,
                  color: on ? colors.black : colors.fog
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
