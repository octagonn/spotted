import { Search, X } from "lucide-react-native";
import { TextInput, View, type StyleProp, type ViewStyle } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Container overrides (margins, radius). */
  containerStyle?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
};

/**
 * App-wide search field: leading magnifier, and a trailing X that clears the
 * field once there's text.
 */
export function SearchBar({ value, onChangeText, placeholder, containerStyle, autoFocus }: SearchBarProps) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.iron,
          borderRadius: 12,
          backgroundColor: colors.graphite,
          paddingVertical: 10,
          paddingHorizontal: 14
        },
        containerStyle
      ]}
    >
      <Search color={colors.ash} size={17} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.fog}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={{ flex: 1, padding: 0, fontSize: 14, color: colors.bone }}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8} accessibilityLabel="Clear search" haptic={false}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.iron,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={12} color={colors.silver} strokeWidth={2.6} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
