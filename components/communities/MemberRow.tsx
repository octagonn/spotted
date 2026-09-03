import { Check, MoreHorizontal, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { PillBadge, TenureChip } from "@/components/communities/Badges";
import { RoleChip } from "@/components/communities/RoleChip";
import { IconButton } from "@/components/ui/IconButton";
import { UserRow } from "@/components/ui/UserRow";
import type { CommunityMember } from "@/hooks/queries/useCommunities";
import { tenureBadge } from "@/lib/communityTenure";
import { relDay } from "@/lib/relDay";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

type MemberRowProps = {
  member: CommunityMember;
  communityCreatedAt: string | null | undefined;
  isMe: boolean;
  isOwner?: boolean;
  showDefaultRole?: boolean;
  /** Managers: opens the role / remove sheet. */
  onManage?: () => void;
  onPress?: () => void;
};

/** A community member: avatar · name (you / OWNER / tenure) · @handle · joined · role. */
export function MemberRow({
  member,
  communityCreatedAt,
  isMe,
  isOwner = false,
  showDefaultRole = false,
  onManage,
  onPress
}: MemberRowProps) {
  const name = member.profile?.display_name ?? "Member";
  const badge = tenureBadge(member.joined_at, communityCreatedAt);
  const trailing: ReactNode[] = [];
  if (isOwner) trailing.push(<PillBadge key="owner" label="Owner" color={tokens.accent.gold} />);
  if (badge) trailing.push(<TenureChip key="tenure" badge={badge} />);
  trailing.push(<RoleChip key="role" role={member.roleInfo} legacyRole={member.role} showDefault={showDefaultRole} />);
  if (onManage) {
    trailing.push(
      <IconButton
        key="manage"
        variant="ghost"
        size={32}
        icon={<MoreHorizontal size={icon.size.xs} color={colors.mist} strokeWidth={icon.stroke.regular} />}
        accessibilityLabel={`Manage ${name}`}
        onPress={onManage}
      />
    );
  }
  return (
    <UserRow
      name={isMe ? `${name} (you)` : name}
      avatarUrl={member.profile?.avatar_url ?? null}
      sub={`@${member.profile?.username ?? "unknown"} · joined ${relDay(member.joined_at)}`}
      right={<View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>{trailing}</View>}
      onPress={onPress}
    />
  );
}

/** A pending join request: avatar · name · @handle · ✓ approve · ✕ deny. */
export function JoinRequestRow({
  name,
  username,
  avatarUrl,
  onApprove,
  onDeny,
  onPress
}: {
  name: string;
  username: string;
  avatarUrl?: string | null;
  onApprove: () => void;
  onDeny: () => void;
  onPress?: () => void;
}) {
  return (
    <UserRow
      name={name}
      avatarUrl={avatarUrl}
      sub={`@${username}`}
      onPress={onPress}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <IconButton
            variant="plain"
            size={36}
            icon={<Check size={icon.size.xs} color={colors.black} strokeWidth={icon.stroke.bold} />}
            accessibilityLabel={`Approve ${name}`}
            haptic="success"
            onPress={onApprove}
            style={{ backgroundColor: colors.white, borderRadius: 999 }}
          />
          <IconButton
            variant="ghost"
            size={36}
            icon={<X size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.bold} />}
            accessibilityLabel={`Deny ${name}`}
            onPress={onDeny}
          />
        </View>
      }
    />
  );
}
