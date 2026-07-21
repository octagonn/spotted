import AsyncStorage from "@react-native-async-storage/async-storage";
import { Hand, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

const SEEN_KEY = "spotted.calendarTapHintSeen";

/**
 * One-time nudge telling the user they can tap a gym day to open that day's
 * post. Shows once, then remembers dismissal in AsyncStorage — so the calendar
 * legend stays clean instead of carrying a permanent "TAP" hint.
 *
 * Styled borderless (no card) so it reads as quiet inline copy under the
 * calendar rather than another stacked widget.
 */
export function CalendarTapHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (active && !seen) {
          setVisible(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    setVisible(false);
    void AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
  };

  return (
    <View
      style={{
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 9
      }}
    >
      <Hand size={14} color={colors.silver} strokeWidth={2} />
      <Text style={{ flex: 1, fontFamily: "Geist_400Regular", fontSize: 12.5, color: colors.silver }}>
        Tap a gym day to open that day&apos;s post.
      </Text>
      <Pressable onPress={dismiss} accessibilityLabel="Dismiss hint" hitSlop={8}>
        <X size={15} color={colors.fog} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
