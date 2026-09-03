import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MemberRow } from "@/components/communities/MemberRow";
import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import {
  NO_PERMISSIONS,
  roleErrorMessage,
  useCommunity,
  useCommunityMembers,
  useCommunityRoles,
  useRemoveCommunityMember,
  useSetMemberRole,
  type CommunityMember,
  type CommunityRole
} from "@/hooks/queries/useCommunities";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

/**
 * Sheet for managers: pick a role for a member, or remove them. The server
 * re-checks everything (owner locked, admin changes need admin, no self-edit).
 */
function ManageMemberSheet({
  communityId,
  member,
  roles,
  canAdmin,
  onProfile
}: {
  communityId: string;
  member: CommunityMember;
  roles: CommunityRole[];
  canAdmin: boolean;
  onProfile: () => void;
}) {
  const sheet = useSheet();
  const setRole = useSetMemberRole(communityId);
  const remove = useRemoveCommunityMember(communityId);
  const name = member.profile?.display_name ?? "Member";
  const currentRoleId = member.role_id ?? roles.find((r) => r.is_default)?.id ?? null;

  const assign = (role: CommunityRole) => {
    if (role.id === currentRoleId) return;
    setRole.mutate(
      { userId: member.user_id, roleId: role.id },
      {
        onSuccess: () => {
          showToast(`${name.split(" ")[0]} is now ${role.name}`);
          sheet.close();
        },
        onError: (error) => showToast(roleErrorMessage(error))
      }
    );
  };

  const confirmRemove = () => {
    sheet.close();
    appAlert("Remove member", `${name} will be removed from the community. They can rejoin later.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(member.user_id, {
            onSuccess: () => showToast(`Removed ${name.split(" ")[0]}`),
            onError: (error) => showToast(roleErrorMessage(error))
          })
      }
    ]);
  };

  return (
    <View>
      <SheetTitle>{name}</SheetTitle>
      <SheetSub>Set their role or remove them from the community.</SheetSub>
      {roles.map((role) => {
        const locked = role.is_admin && !canAdmin;
        return (
          <ChoiceRow
            key={role.id}
            title={role.name}
            sub={
              locked
                ? "Only admins can grant this"
                : role.is_admin
                  ? "Every permission"
                  : role.is_default
                    ? "Default role"
                    : undefined
            }
            selected={role.id === currentRoleId}
            disabled={locked || setRole.isPending}
            onPress={() => assign(role)}
          />
        );
      })}
      <View style={{ paddingHorizontal: space[4] + 4, paddingTop: space[3] + 2, gap: space[2] }}>
        <Button
          variant="ghost"
          onPress={() => {
            sheet.close();
            onProfile();
          }}
        >
          View profile
        </Button>
        <Button variant="ghost" onPress={confirmRemove} loading={remove.isPending}>
          Remove from community
        </Button>
      </View>
    </View>
  );
}

/** Everyone in a community — tap anyone to open their profile; managers get role controls. */
export default function CommunityMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const userId = useAuthStore((state) => state.userId);
  const community = useCommunity(id);
  const members = useCommunityMembers(id);
  const perms = community.data?.perms ?? NO_PERMISSIONS;
  const roles = useCommunityRoles(id, perms.manage_members);
  const ownerId = community.data?.createdBy ?? null;
  const createdAt = community.data?.createdAt;
  const rolesData = roles.data;

  const openProfile = useCallback(
    (member: CommunityMember) => {
      if (!member.profile) return;
      if (member.user_id === userId) router.push("/(tabs)/profile" as Href);
      else router.push(`/user/${member.profile.username}` as Href);
    },
    [router, userId]
  );

  const openManage = useCallback(
    (member: CommunityMember) => {
      sheet.open(
        <ManageMemberSheet
          communityId={id}
          member={member}
          roles={rolesData ?? []}
          canAdmin={perms.admin}
          onProfile={() => openProfile(member)}
        />
      );
    },
    [sheet, id, rolesData, perms.admin, openProfile]
  );

  const renderItem: ListRenderItem<CommunityMember> = useCallback(
    ({ item }) => {
      const manageable = perms.manage_members && item.user_id !== userId && item.user_id !== ownerId;
      return (
        <MemberRow
          member={item}
          communityCreatedAt={createdAt}
          isMe={item.user_id === userId}
          isOwner={item.user_id === ownerId}
          showDefaultRole={perms.manage_members}
          onManage={manageable ? () => openManage(item) : undefined}
          onPress={() => openProfile(item)}
        />
      );
    },
    [perms.manage_members, userId, ownerId, createdAt, openManage, openProfile]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Members"
        sub={community.data ? `${community.data.name} · ${community.data.memberCount}` : undefined}
      />
      {members.isLoading ? (
        <SkeletonRows count={5} avatar={44} />
      ) : (
        <FlashList
          data={members.data ?? []}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space[6], paddingTop: space[1] }}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text variant="meta" className="pt-10 text-center">
              No members yet.
            </Text>
          }
        />
      )}
    </View>
  );
}
