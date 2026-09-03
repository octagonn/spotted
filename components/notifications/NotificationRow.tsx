import { Image } from "expo-image";
import { ChevronRight, MessageCircle, ShieldCheck, Swords, UserPlus, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { AppNotification } from "@/hooks/queries/useNotifications";
import { mergedNotificationText, timeAgo } from "@/lib/notificationCopy";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

const ROW_AVATAR = 44;

/** Notification avatar with a small type-icon badge. Friend → friend icon,
 *  message → message icon, streak break → swords. Others have no badge. */
function NotifAvatar({ name, avatar, type }: { name: string; avatar: string | null; type: string }) {
  let Icon: LucideIcon | null = null;
  if (type === "friend_request" || type === "friend_accepted") Icon = UserPlus;
  else if (type === "dm") Icon = MessageCircle;
  else if (type === "streak_break_friend") Icon = Swords;
  return (
    <View style={{ width: ROW_AVATAR, height: ROW_AVATAR }}>
      <Avatar name={name} uri={avatar} size={ROW_AVATAR} />
      {Icon ? (
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 20,
            height: 20,
            borderRadius: radius.pill,
            backgroundColor: tokens.bg.raised,
            borderWidth: 1.5,
            borderColor: colors.black,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Icon size={11} color={colors.mist} strokeWidth={icon.stroke.bold} />
        </View>
      ) : null}
    </View>
  );
}

function UnreadDot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} />;
}

const rowStyle = (read: boolean) =>
  ({
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    backgroundColor: read ? "transparent" : colors.glassSoft
  }) as const;

type NotificationRowProps = {
  notification: AppNotification;
  onPress: () => void;
  /** Inline action (Join/Ignore, Taunt) rendered before the thumbnail. */
  action?: ReactNode;
};

/** Actor · copy · time, with an optional action and a post thumbnail on the right. */
export function NotificationRow({ notification: n, onPress, action }: NotificationRowProps) {
  const joiner = n.type === "streak_break_friend" ? "" : " ";
  return (
    <Pressable
      onPress={onPress}
      haptic="none"
      accessibilityLabel={`${n.actorName}${joiner}${mergedNotificationText(n)}, ${timeAgo(n.createdAt)}${n.read ? "" : ", unread"}`}
    >
      <View style={rowStyle(n.read)}>
        <NotifAvatar name={n.actorName} avatar={n.actorAvatar} type={n.type} />
        <Text variant="body-sm" className="flex-1 text-mist">
          <Text variant="body-sm-strong">{n.actorName}</Text>
          {joiner}
          {mergedNotificationText(n)}
          <Text variant="body-sm" className="text-fog">{`  ${timeAgo(n.createdAt)}`}</Text>
        </Text>
        {action}
        {n.postThumbUrl ? (
          <Image
            source={{ uri: n.postThumbUrl }}
            accessible={false}
            contentFit="cover"
            style={{ width: 40, height: 50, borderRadius: radius.sm - 4, backgroundColor: tokens.bg.raised }}
          />
        ) : null}
        {!n.read ? <UnreadDot /> : null}
      </View>
    </Pressable>
  );
}

/** Actor-less account/policy notice: the payload carries its own title + body. */
export function SystemNoticeRow({ notice, onOpen }: { notice: AppNotification; onOpen: () => void }) {
  const title = String(notice.payload?.title ?? "Spotted update");
  const body = typeof notice.payload?.body === "string" ? notice.payload.body : null;
  return (
    <Pressable
      onPress={onOpen}
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body ?? ""} ${timeAgo(notice.createdAt)}`}
    >
      <View style={rowStyle(notice.read)}>
        <View
          style={{
            width: ROW_AVATAR,
            height: ROW_AVATAR,
            borderRadius: radius.pill,
            backgroundColor: tokens.bg.raised,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <ShieldCheck size={icon.size.sm} color={colors.white} strokeWidth={icon.stroke.regular} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="username">
            {title}
            <Text variant="meta">{`  ${timeAgo(notice.createdAt)}`}</Text>
          </Text>
          {body ? (
            <Text variant="meta" numberOfLines={3} className="text-mist mt-[2px]">
              {body}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={icon.size.xs + 2} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
        {!notice.read ? <UnreadDot /> : null}
      </View>
    </Pressable>
  );
}
