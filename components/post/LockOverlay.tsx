import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Camera, Lock } from "lucide-react-native";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme/colors";

/**
 * Locked-feed gate (§4.6). Captures ALL touches and paints a near-opaque
 * backdrop over the post list so other people's posts can't be read or tapped
 * until you've posted — the core "post to unlock" mechanic. (Was box-none with
 * a light gradient, which let the feed show through.)
 */
export function LockOverlay() {
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,6,6,0.94)" }}>
      <LinearGradient
        colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.3)"]}
        locations={[0, 0.45, 1]}
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ alignItems: "center", marginTop: 120 }}>
        <View style={{ maxWidth: 270, alignItems: "center" }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              borderWidth: 1.5,
              borderColor: colors.slate,
              backgroundColor: "rgba(10,10,10,0.85)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Lock size={22} color={colors.white} strokeWidth={2} />
          </View>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: "Boldonse_400Regular",
              fontSize: 17,
              lineHeight: 17 * 1.5 + 8,
              color: colors.white,
              textAlign: "center",
              marginTop: 14,
              includeFontPadding: false
            }}
          >
            Go to the gym to unlock today's feed.
          </Text>
          <Text style={{ fontSize: 13, color: colors.silver, lineHeight: 13 * 1.5, textAlign: "center", marginTop: 8 }}>
            Post a photo from your session to see what everyone else is doing.
          </Text>
          <Pressable
            onPress={() => router.push("/camera")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.white,
              borderRadius: 999,
              paddingVertical: 12,
              paddingHorizontal: 26,
              marginTop: 16
            }}
          >
            <Camera size={16} color={colors.black} strokeWidth={2.2} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13.5, color: colors.black }}>
              Post today's SPOTTED
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
