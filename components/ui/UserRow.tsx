import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/ListRow";

export const USER_ROW_AVATAR = 44;
export const USER_ROW_AVATAR_BIG = 56;

type UserRowProps = {
  name: string;
  avatarUrl?: string | null;
  /** Secondary line — "@handle", a preview, a reason ("2 mutual friends"). */
  sub?: string;
  subStrong?: boolean;
  /** Inbox-style: taller row, 56pt avatar. */
  big?: boolean;
  time?: string;
  unread?: boolean;
  /** Trailing control (RelButton, Accept/Decline pair, chevron…). */
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * The one way to show a person in a list: avatar · name · sub · trailing.
 * Avatar is 44pt (56pt `big`) — never size it per screen.
 */
export function UserRow({
  name,
  avatarUrl,
  sub,
  subStrong,
  big = false,
  time,
  unread,
  right,
  onPress,
  onLongPress
}: UserRowProps) {
  return (
    <ListRow
      big={big}
      left={<Avatar name={name} uri={avatarUrl} size={big ? USER_ROW_AVATAR_BIG : USER_ROW_AVATAR} />}
      name={name}
      sub={sub}
      subStrong={subStrong}
      time={time}
      unread={unread}
      right={right}
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}
