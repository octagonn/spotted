import { Image } from "expo-image";
import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * App-wide empty / locked / coming-soon state: an icon in a hairline circle,
 * a bold title, muted body copy, and an optional action slot underneath.
 * One component so the ~10 screens that show one of these stay in lockstep.
 *
 * `tone="gold"` is the feed-lock treatment (gold ring + faint gold fill).
 * `center` fills the available space and centers vertically (whole-screen
 * states like Coming Soon); the default variant top-aligns with `paddingTop`
 * for states that live below a header or tab bar.
 */
export function EmptyState({
  icon,
  art,
  tone = "default",
  title,
  body,
  children,
  paddingTop = 44,
  center = false
}: {
  /** Icon node rendered inside the circle (caller picks size/color). */
  icon?: ReactNode;
  /** Illustration (see lib/emptyStateArt) rendered instead of the icon circle. */
  art?: number;
  tone?: "default" | "gold";
  title: string;
  body?: string;
  /** Optional action area (e.g. a Button) rendered under the body. */
  children?: ReactNode;
  paddingTop?: number;
  center?: boolean;
}) {
  return (
    <View
      style={
        center
          ? { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 48, paddingBottom: 80 }
          : { alignItems: "center", paddingTop, paddingHorizontal: 40 }
      }
    >
      {art ? (
        <Image source={art} contentFit="contain" style={{ width: 116, height: 116 }} accessible={false} />
      ) : icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: tone === "gold" ? colors.gold : colors.slate,
            backgroundColor: tone === "gold" ? "rgba(232,180,76,0.12)" : undefined,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text
        style={{
          marginTop: art ? 10 : icon ? 16 : 0,
          fontFamily: "Geist_700Bold",
          fontSize: 15,
          color: colors.white,
          textAlign: "center"
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: colors.fog, textAlign: "center" }}>{body}</Text>
      ) : null}
      {children ? <View style={{ paddingTop: 18, alignSelf: "stretch", paddingHorizontal: 40 }}>{children}</View> : null}
    </View>
  );
}
