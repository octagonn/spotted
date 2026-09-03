import { Image } from "expo-image";
import { Bell } from "lucide-react-native";
import { Text as RNText, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

type FeedHeaderProps = {
  unreadCount: number;
  onOpenInbox: () => void;
};

/**
 * Home feed app head: brand mark left, SPOTTED wordmark centered, activity
 * bell right. The left/right zones are the same width so the wordmark is
 * truly centered. One 16pt gutter shared with the rail, segmented and posts.
 */
export function FeedHeader({ unreadCount, onOpenInbox }: FeedHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingTop: space[2],
        paddingHorizontal: space[4],
        paddingBottom: space[1]
      }}
    >
      <View style={{ width: 44, alignItems: "flex-start", justifyContent: "center" }}>
        <Image
          source={require("../../assets/images/welcome-mark.png")}
          accessible={false}
          contentFit="contain"
          style={{ width: 40, height: 26 }}
        />
      </View>
      {/* Wordmark: Boldonse is display-only and needs a generous line box or it
          clips — the one place the feed reaches past the Text variants. */}
      <RNText
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: "Boldonse_400Regular",
          fontSize: 18,
          lineHeight: 18 * 1.4 + 8,
          letterSpacing: 18 * 0.01,
          color: tokens.text.primary,
          includeFontPadding: false
        }}
      >
        SPOTTED
      </RNText>
      <Pressable
        onPress={onOpenInbox}
        haptic="none"
        accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        hitSlop={8}
        style={{ width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}
      >
        <View>
          <Bell size={icon.size.md} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
          {unreadCount > 0 ? (
            <View
              style={{
                position: "absolute",
                top: -6,
                right: -8,
                minWidth: 18,
                height: 18,
                borderRadius: radius.pill,
                paddingHorizontal: 4,
                backgroundColor: tokens.status.danger,
                borderWidth: 1.5,
                borderColor: colors.black,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text variant="label" className="font-sansBold text-pure">
                {unreadCount > 9 ? "9+" : String(unreadCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
