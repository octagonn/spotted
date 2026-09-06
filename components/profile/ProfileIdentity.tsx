import { ChevronRight, MapPin } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { SocialLinksRow } from "@/components/profile/SocialLinksRow";
import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Stat } from "@/components/ui/Stat";
import { Text } from "@/components/ui/Text";
import { icon, radius, space, tokens } from "@/theme/tokens";

export const PROFILE_GUTTER = space[4];
const AVATAR_OUTER = 88;

type ProfileIdentityProps = {
  name: string;
  handle: string;
  avatarUrl?: string | null;
  /** Tapping the avatar (zooms the photo, or edits it on your own profile). */
  onAvatarPress?: () => void;
  onAvatarLongPress?: () => void;
  avatarAccessibilityLabel: string;
  postCount: number;
  friendCount: number;
  onPressFriends?: () => void;
  bio?: string | null;
  gym?: string | null;
  /** Owner only: tapping the gym line edits it; shows a placeholder when unset. */
  onPressGym?: () => void;
  socialLinks?: unknown;
  /** Extra content below the identity block (action buttons, mutuals). */
  children?: ReactNode;
};

/**
 * The social identity block shared by own and other-user profiles:
 * avatar · posts / friends · name · bio · gym · socials.
 * Identity first; everything below it is context.
 */
export function ProfileIdentity({
  name,
  handle,
  avatarUrl,
  onAvatarPress,
  onAvatarLongPress,
  avatarAccessibilityLabel,
  postCount,
  friendCount,
  onPressFriends,
  bio,
  gym,
  onPressGym,
  socialLinks,
  children
}: ProfileIdentityProps) {
  const avatarSize = AVATAR_OUTER - 4;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: PROFILE_GUTTER, gap: space[4] }}>
        <View style={{ width: AVATAR_OUTER, height: AVATAR_OUTER, alignItems: "center", justifyContent: "center" }}>
          <Pressable
            onPress={onAvatarPress}
            onLongPress={onAvatarLongPress}
            delayLongPress={220}
            disabled={!onAvatarPress && !onAvatarLongPress}
            haptic="none"
            accessibilityLabel={avatarAccessibilityLabel}
          >
            <View
              style={{
                width: AVATAR_OUTER,
                height: AVATAR_OUTER,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Avatar name={name || handle || "?"} uri={avatarUrl} size={avatarSize} />
            </View>
          </Pressable>
        </View>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <Stat value={postCount} label={postCount === 1 ? "post" : "posts"} />
          <Stat value={friendCount} label="friends" onPress={onPressFriends} />
        </View>
      </View>

      <View style={{ paddingHorizontal: PROFILE_GUTTER, paddingTop: space[3], gap: space[1] }}>
        {name ? <Text variant="subheading">{name}</Text> : null}
        {bio ? (
          <Text variant="body-sm" className="text-mist">
            {bio}
          </Text>
        ) : null}
        {gym || onPressGym ? (
          <Pressable
            onPress={onPressGym}
            disabled={!onPressGym}
            haptic="none"
            accessibilityLabel={
              onPressGym ? (gym ? `Home gym ${gym}. Change home gym` : "Set your home gym") : `Home gym ${gym}`
            }
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
              <MapPin size={13} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
              <Text variant="meta" className={gym ? "text-silver" : ""}>
                {gym ?? "Set your home gym"}
              </Text>
              {onPressGym ? (
                <ChevronRight size={12} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
              ) : null}
            </View>
          </Pressable>
        ) : null}
        <SocialLinksRow links={socialLinks} />
      </View>
      {children}
    </View>
  );
}
