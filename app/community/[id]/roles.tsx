import { useLocalSearchParams } from "expo-router";
import { ChevronRight, Plus, Shield, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillBadge } from "@/components/communities/Badges";
import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { ColorWheel } from "@/components/ui/ColorWheel";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SettingRow, SettingSectionLabel, SettingToggle } from "@/components/ui/SettingRow";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import {
  roleErrorMessage,
  useCommunity,
  useCommunityRoles,
  useCreateCommunityRole,
  useDeleteCommunityRole,
  useUpdateCommunityRole,
  type CommunityRole,
  type RoleInput
} from "@/hooks/queries/useCommunities";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

type Draft = Required<Omit<RoleInput, "position">>;
const GUTTER = space[4] + 2;

const NEW_ROLE: Draft = {
  name: "",
  color: null,
  is_default: false,
  is_admin: false,
  can_view_chat: true,
  can_send_messages: true,
  can_view_posts: true,
  can_post: true,
  can_invite: true,
  can_manage_members: false,
  can_manage_roles: false
};

function toDraft(role: CommunityRole): Draft {
  return {
    name: role.name,
    color: role.color,
    is_default: role.is_default,
    is_admin: role.is_admin,
    can_view_chat: role.can_view_chat,
    can_send_messages: role.can_send_messages,
    can_view_posts: role.can_view_posts,
    can_post: role.can_post,
    can_invite: role.can_invite,
    can_manage_members: role.can_manage_members,
    can_manage_roles: role.can_manage_roles
  };
}

/** One-line summary of what a role can do, for the list. */
function permSummary(role: CommunityRole): string {
  if (role.is_admin) return "Admin — everything";
  const parts: string[] = [];
  if (!role.can_view_chat) parts.push("no chat");
  else if (!role.can_send_messages) parts.push("read-only chat");
  else parts.push("chat");
  if (!role.can_view_posts) parts.push("no posts");
  else if (role.can_post) parts.push("post");
  else parts.push("view posts");
  if (role.can_invite) parts.push("invite");
  if (role.can_manage_members) parts.push("manage members");
  if (role.can_manage_roles) parts.push("manage roles");
  return parts.join(" · ");
}

/**
 * Community roles (Discord-style): rename, recolor, and set what each role
 * can do. The default role is what new members get; admin roles get every
 * permission. The owner always has everything and can't be reassigned.
 * Server triggers enforce the guard rails (last admin role, default role).
 */
export default function CommunityRolesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const community = useCommunity(id);
  const roles = useCommunityRoles(id);
  const create = useCreateCommunityRole(id);
  const update = useUpdateCommunityRole(id);
  const remove = useDeleteCommunityRole(id);

  const perms = community.data?.perms;
  const canManage = perms?.manage_roles ?? false;
  const isAdmin = perms?.admin ?? false;

  // "new" = creating; a role = editing; null = list.
  const [editing, setEditing] = useState<CommunityRole | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(NEW_ROLE);

  const openNew = () => {
    setDraft(NEW_ROLE);
    setEditing("new");
  };
  const openEdit = (role: CommunityRole) => {
    setDraft(toDraft(role));
    setEditing(role);
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      showToast("Give the role a name");
      return;
    }
    const payload: RoleInput = { ...draft, name };
    const done = () => {
      showToast(editing === "new" ? "Role created" : "Role saved");
      setEditing(null);
    };
    const fail = (error: unknown) => showToast(roleErrorMessage(error));
    if (editing === "new") {
      const position = (roles.data ?? []).reduce((m, r) => Math.max(m, r.position), 0) + 1;
      create.mutate({ ...payload, name, position }, { onSuccess: done, onError: fail });
    } else if (editing) {
      update.mutate({ roleId: editing.id, ...payload }, { onSuccess: done, onError: fail });
    }
  };

  const confirmDelete = (role: CommunityRole) => {
    appAlert("Delete role", `Members with "${role.name}" fall back to the default role.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          remove.mutate(role.id, {
            onSuccess: () => {
              showToast("Role deleted");
              setEditing(null);
            },
            onError: (error) => showToast(roleErrorMessage(error))
          })
      }
    ]);
  };

  if (community.isLoading || roles.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Roles" />
        <SkeletonRows count={3} />
      </View>
    );
  }

  if (!canManage) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Roles" />
        <EmptyState
          icon={<Shield size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />}
          title="Managers only"
          body="Only members who can manage roles can open this."
        />
      </View>
    );
  }

  // ---------------------------------------------------------------- editor
  if (editing) {
    const isNew = editing === "new";
    const lockedAdminEdit = !isNew && editing.is_admin && !isAdmin;
    const pending = create.isPending || update.isPending;
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: colors.black }}
      >
        <PanelHeader title={isNew ? "New role" : "Edit role"} onBack={() => setEditing(null)} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + space[6] + 4 }}
        >
          <SettingSectionLabel>Name</SettingSectionLabel>
          <TextField
            value={draft.name}
            onChangeText={(v) => set("name", v.slice(0, 32))}
            placeholder="e.g. Coach, VIP, Moderator"
            accessibilityLabel="Role name"
            autoCapitalize="words"
            maxLength={32}
            editable={!lockedAdminEdit}
          />

          <SettingSectionLabel>Color</SettingSectionLabel>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingBottom: space[3] + 2 }}>
            <PillBadge label={draft.name.trim() || "Role name"} color={draft.color ?? colors.silver} />
            <Text variant="mono" className="flex-1">
              {draft.color ?? "No color"}
            </Text>
            {draft.color ? (
              <Pressable onPress={() => set("color", null)} accessibilityLabel="Clear color" hitSlop={8} haptic="none">
                <Text variant="meta-strong">Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <ColorWheel value={draft.color} onChange={(hex) => set("color", hex)} />

          <SettingSectionLabel>Permissions</SettingSectionLabel>
          {isAdmin ? (
            <SettingRow
              title="Admin"
              sub="Every permission, including editing the community and other admin roles"
              right={<SettingToggle value={draft.is_admin} onToggle={() => set("is_admin", !draft.is_admin)} />}
            />
          ) : null}
          <PermToggle
            title="View chat"
            sub="See the community chat at all"
            value={draft.can_view_chat}
            forced={draft.is_admin}
            onToggle={() => {
              const next = !draft.can_view_chat;
              set("can_view_chat", next);
              if (!next) set("can_send_messages", false);
            }}
          />
          <PermToggle
            title="Send messages"
            sub="Off = read-only chat for this role"
            value={draft.can_send_messages}
            forced={draft.is_admin}
            disabled={!draft.can_view_chat}
            onToggle={() => set("can_send_messages", !draft.can_send_messages)}
          />
          <PermToggle
            title="View posts"
            sub="See the community feed at all"
            value={draft.can_view_posts}
            forced={draft.is_admin}
            onToggle={() => {
              const next = !draft.can_view_posts;
              set("can_view_posts", next);
              if (!next) set("can_post", false);
            }}
          />
          <PermToggle
            title="Post"
            sub="Share photos and workouts to the community feed"
            value={draft.can_post}
            forced={draft.is_admin}
            disabled={!draft.can_view_posts}
            onToggle={() => set("can_post", !draft.can_post)}
          />
          <PermToggle
            title="Invite friends"
            sub="Send invites to this community"
            value={draft.can_invite}
            forced={draft.is_admin}
            onToggle={() => set("can_invite", !draft.can_invite)}
          />
          <PermToggle
            title="Manage members"
            sub="Approve requests, assign roles, remove members"
            value={draft.can_manage_members}
            forced={draft.is_admin}
            onToggle={() => set("can_manage_members", !draft.can_manage_members)}
          />
          <PermToggle
            title="Manage roles"
            sub="Create, rename, and edit non-admin roles"
            value={draft.can_manage_roles}
            forced={draft.is_admin}
            onToggle={() => set("can_manage_roles", !draft.can_manage_roles)}
          />

          <SettingSectionLabel>Default</SettingSectionLabel>
          <SettingRow
            title="Default role"
            sub={
              !isNew && editing.is_default
                ? "New members get this role. Make another role the default to change it."
                : "New members get this role when they join"
            }
            right={
              <SettingToggle
                value={draft.is_default}
                disabled={!isNew && editing.is_default}
                onToggle={() => set("is_default", !draft.is_default)}
              />
            }
          />

          <View style={{ paddingTop: space[6] + 2, gap: space[2] + 2 }}>
            <Button onPress={save} loading={pending} disabled={lockedAdminEdit}>
              {isNew ? "Create role" : "Save changes"}
            </Button>
            {!isNew && !editing.is_default && !lockedAdminEdit ? (
              <Button
                variant="danger"
                onPress={() => confirmDelete(editing)}
                loading={remove.isPending}
                icon={<Trash2 size={icon.size.xs - 1} color={tokens.status.danger} strokeWidth={icon.stroke.regular} />}
              >
                Delete role
              </Button>
            ) : null}
            {lockedAdminEdit ? (
              <Text variant="meta" className="text-center">
                Only admins can edit admin roles.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---------------------------------------------------------------- list
  const list = roles.data ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Roles" sub={community.data?.name} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + space[6] + 4 }}>
        <Text variant="meta" className="pb-[6px] pt-2">
          Roles decide who can chat, post, invite, and manage. The owner always has every permission.
        </Text>
        {list.map((role) => (
          <Pressable
            key={role.id}
            onPress={() => openEdit(role)}
            accessibilityLabel={`Edit role ${role.name}`}
            haptic="none"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space[3],
                paddingVertical: space[3] + 1,
                borderBottomWidth: 1,
                borderBottomColor: colors.graphite
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  borderWidth: 1,
                  borderColor: role.color ?? tokens.border.default,
                  backgroundColor: role.color ? `${role.color}26` : "transparent",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Shield size={icon.size.xs} color={role.color ?? colors.silver} strokeWidth={icon.stroke.regular} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] + 2 }}>
                  {/* Role color is data-driven — the one raw Text on this screen. */}
                  <RNText
                    numberOfLines={1}
                    maxFontSizeMultiplier={2}
                    style={{
                      flexShrink: 1,
                      fontFamily: "Geist_600SemiBold",
                      fontSize: 15,
                      lineHeight: 20,
                      color: role.color ?? colors.white
                    }}
                  >
                    {role.name}
                  </RNText>
                  {role.is_default ? <PillBadge label="Default" color={colors.silver} /> : null}
                </View>
                <Text variant="meta" numberOfLines={1} className="mt-[1px]">
                  {permSummary(role)}
                </Text>
              </View>
              <ChevronRight size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
            </View>
          </Pressable>
        ))}
        <View style={{ paddingTop: space[4] + 2 }}>
          <Button
            variant="ghost"
            onPress={openNew}
            icon={<Plus size={icon.size.xs - 1} color={colors.white} strokeWidth={icon.stroke.bold} />}
          >
            New role
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

/** A permission toggle; admin roles show it forced on. */
function PermToggle({
  title,
  sub,
  value,
  forced,
  disabled,
  onToggle
}: {
  title: string;
  sub: string;
  value: boolean;
  forced: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <SettingRow
      title={title}
      sub={forced ? "Included with Admin" : sub}
      right={<SettingToggle value={forced || value} disabled={forced || disabled} onToggle={onToggle} />}
    />
  );
}
