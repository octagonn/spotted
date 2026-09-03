import { Home, MapPin, MoreHorizontal } from "lucide-react-native";
import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { icon, space, tokens } from "@/theme/tokens";

type PostHeaderProps = {
  user: { name: string; handle: string; avatarUrl?: string | null };
  /** Mapped gym name; when absent `altLoc` (home / unlisted) is shown dimmer + italic. */
  gym?: string;
  altLoc?: string;
  time: string;
  locked?: boolean;
  onOpenProfile: () => void;
  /** When provided, a ⋯ button opens the post menu. */
  onOpenMenu?: () => void;
};

/** Identity row: avatar · handle + location · time · menu. Identity first, context second. */
export function PostHeader({ user, gym, altLoc, time, locked = false, onOpenProfile, onOpenMenu }: PostHeaderProps) {
  const LocIcon = gym ? MapPin : Home;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingHorizontal: space[4],
        paddingBottom: space[3],
        opacity: locked ? 0.55 : 1
      }}
    >
      <Pressable onPress={onOpenProfile} haptic="none" accessibilityLabel={`Open @${user.handle}'s profile`}>
        <Avatar name={user.name} uri={user.avatarUrl} size={40} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onOpenProfile}
          haptic="none"
          hitSlop={4}
          accessibilityLabel={`Open @${user.handle}'s profile`}
        >
          <Text variant="username" numberOfLines={1}>
            {user.handle}
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 1 }}>
          <LocIcon size={12} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
          <Text variant="meta" className={gym ? "text-silver" : "italic"} numberOfLines={1}>
            {gym ?? altLoc ?? ""}
          </Text>
        </View>
      </View>
      <Text variant="meta">{time}</Text>
      {onOpenMenu ? (
        <Pressable
          onPress={onOpenMenu}
          haptic="none"
          accessibilityLabel="Post options"
          hitSlop={8}
          style={{ paddingLeft: space[2] }}
        >
          <MoreHorizontal size={icon.size.sm} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
        </Pressable>
      ) : null}
    </View>
  );
}
