import { appAlert } from "@/components/ui/AppDialog";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { MoreHorizontal } from "lucide-react-native";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RoleChip } from "@/components/communities/RoleChip";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";
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
import { relDay } from "@/lib/relDay";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

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
            sub={locked ? "Only admins can grant this" : role.is_admin ? "Every permission" : role.is_default ? "Default role" : undefined}
            selected={role.id === currentRoleId}
            disabled={locked || setRole.isPending}
            onPress={() => assign(role)}
          />
        );
      })}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 8 }}>
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

  const openProfile = (member: CommunityMember) => {
    if (!member.profile) return;
    if (member.user_id === userId) router.push("/(tabs)/profile" as Href);
    else router.push(`/user/${member.profile.username}` as Href);
  };

  const canManageRow = (member: CommunityMember) =>
    perms.manage_members && member.user_id !== userId && member.user_id !== ownerId;

  const openManage = (member: CommunityMember) => {
    sheet.open(
      <ManageMemberSheet
        communityId={id}
        member={member}
        roles={roles.data ?? []}
        canAdmin={perms.admin}
        onProfile={() => openProfile(member)}
      />
    );
  };

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
          keyExtractor={(item: CommunityMember) => item.user_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 4 }}
          renderItem={({ item }: { item: CommunityMember }) => {
            const name = item.profile?.display_name ?? "Member";
            const manageable = canManageRow(item);
            return (
              <Pressable onPress={() => openProfile(item)} accessibilityLabel={`Open ${name}'s profile`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 18 }}>
                  <Avatar name={name} uri={item.profile?.avatar_url ?? null} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>
                        {name}
                        {item.user_id === userId ? <Text style={{ color: colors.fog }}>  (you)</Text> : null}
                      </Text>
                      {item.user_id === ownerId ? (
                        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, letterSpacing: 0.8, color: colors.gold }}>OWNER</Text>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>
                      @{item.profile?.username ?? "unknown"} · joined {relDay(item.joined_at)}
                    </Text>
                  </View>
                  <RoleChip role={item.roleInfo} legacyRole={item.role} showDefault={perms.manage_members} />
                  {manageable ? (
                    <Pressable onPress={() => openManage(item)} accessibilityLabel={`Manage ${name}`} hitSlop={8}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                        <MoreHorizontal size={16} color={colors.mist} strokeWidth={2} />
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
              No members yet.
            </Text>
          }
        />
      )}
    </View>
  );
}
