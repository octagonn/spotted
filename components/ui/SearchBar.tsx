import { Search, X } from "lucide-react-native";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { SheetTextInput } from "@/components/ui/SheetTextInput";
import { colors } from "@/theme/colors";

type SearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Container overrides (margins, radius). */
  containerStyle?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  /** Fired when the field gains focus — e.g. to scroll it above the keyboard. */
  onFocus?: () => void;
};

/**
 * App-wide search field: leading magnifier, and a trailing X that clears the
 * field once there's text.
 */
export function SearchBar({ value, onChangeText, placeholder, containerStyle, autoFocus, onFocus }: SearchBarProps) {
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
      {/* Sheet-aware: inside the bottom-sheet host this drives the sheet's
          keyboard behavior (field rises above the keyboard, results visible). */}
      <SheetTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.fog}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        onFocus={onFocus}
        returnKeyType="search"
        style={{ flex: 1, padding: 0, fontSize: 14, letterSpacing: 0, fontFamily: "Geist_400Regular", color: colors.bone }}
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
