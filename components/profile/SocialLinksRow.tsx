import { useMemo } from "react";
import { Linking, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { parseSocialLinks, socialEntries } from "@/lib/socialLinks";
import { colors } from "@/theme/colors";

/**
 * Row of tappable 36px social-icon circles under the profile bio. Renders
 * nothing when the profile has no links. Shared by the own-profile and
 * other-user profile screens.
 */
export function SocialLinksRow({ links }: { links: unknown }) {
  const socials = useMemo(() => socialEntries(parseSocialLinks(links)), [links]);
  if (!socials.length) return null;
  return (
    <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {socials.map(({ meta, url }) => (
        <Pressable key={meta.key} onPress={() => void Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={meta.label} hitSlop={6}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.iron,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <meta.icon size={17} color={colors.silver} strokeWidth={2} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
