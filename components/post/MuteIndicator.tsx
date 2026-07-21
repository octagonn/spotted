import { Volume2, VolumeX } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { colors } from "@/theme/colors";

/**
 * Instagram-style speaker popup — shows the current mute state briefly on the
 * post the user tapped, then fades. Driven by `nonce` (increments per toggle);
 * `local` starts false so it doesn't flash on mount, only on real taps here.
 */
export function MuteIndicator({ muted, nonce, local }: { muted: boolean; nonce: number; local: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show when THIS post caused the toggle (its local counter matches).
    if (local === 0 || local !== nonce) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 900);
    return () => clearTimeout(t);
  }, [nonce, local]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        entering={FadeIn.duration(120)}
        exiting={FadeOut.duration(400)}
        style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
      >
        {muted ? (
          <VolumeX size={28} color={colors.white} strokeWidth={2} />
        ) : (
          <Volume2 size={28} color={colors.white} strokeWidth={2} fill={colors.white} />
        )}
      </Animated.View>
    </View>
  );
}
