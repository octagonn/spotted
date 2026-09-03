import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ban, Bell, BellOff, Flag, LogOut, Play, UserPlus, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReportSheet } from "@/components/ReportSheet";
import { appAlert } from "@/components/ui/AppDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { MenuRow } from "@/components/ui/MenuRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SettingNavRow } from "@/components/ui/SettingRow";
import { useSheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useFriends } from "@/hooks/queries/useFriends";
import {
  useAddGroupMembers,
  useChatMedia,
  useGroupInfo,
  useLeaveGroup,
  useRenameGroup,
  type ChatMediaItem
} from "@/hooks/queries/useMessages";
import { useBlockedUsers, useConversationMuted, useSetConversationMuted } from "@/hooks/queries/useMessagesExtras";
import { useProfileById } from "@/hooks/queries/useProfile";
import { useBlockUser, useUnblockUser } from "@/hooks/queries/useSafety";
import { groupDisplayName } from "@/lib/groupName";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

const MAX_MEMBERS = 16;

function VideoViewerBody({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />;
}

function Section({ children }: { children: string }) {
  return (
    <SectionLabel style={{ paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: space[2] }}>
      {children}
    </SectionLabel>
  );
}

/**
 * Conversation details, opened by tapping the name in the chat header.
 * Groups: rename (any member may), members + add people, media, mute /
 * report / leave. 1:1 (`?peer=<profileId>`): the person, media, mute / block
 * / report — the only home for these since the chat's ⋯ menu was removed.
 */
export default function ChatDetailsScreen() {
  const { id: conversationId = "", peer } = useLocalSearchParams<{ id: string; peer?: string }>();
  const isGroup = !peer;
  const router = useRouter();
  const sheet = useSheet();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const userId = useAuthStore((state) => state.userId);

  const groupInfo = useGroupInfo(conversationId, isGroup);
  const media = useChatMedia(conversationId);
  const friends = useFriends();
  const addMembers = useAddGroupMembers();
  const renameGroup = useRenameGroup();
  const leaveGroup = useLeaveGroup();
  const muted = useConversationMuted(conversationId);
  const setMuted = useSetConversationMuted(conversationId);
  const peerProfile = useProfileById(peer);
  const blocked = useBlockedUsers();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const peerBlocked = Boolean(peer && blocked.data?.has(peer));

  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  // Rename draft: null = untouched (mirror the stored title). The per-viewer
  // auto-name is a placeholder, never stored text.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ChatMediaItem | null>(null);

  const members = groupInfo.data?.members ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const addable = (friends.data ?? []).filter((f) => !memberIds.has(f.id));
  const roomLeft = MAX_MEMBERS - members.length;
  const displayName = groupDisplayName(groupInfo.data?.title, members, userId);
  const storedTitle = groupInfo.data?.title?.trim() ?? "";
  const draft = nameDraft ?? storedTitle;
  const nameDirty = draft.trim() !== storedTitle;

  const cellW = Math.floor((winW - space[4] * 2 - 2 * 2) / 3);

  const saveName = () => {
    const next = draft.trim();
    if (!next || !nameDirty || renameGroup.isPending) return;
    renameGroup.mutate(
      { conversationId, title: next },
      {
        onSuccess: () => {
          setNameDraft(null);
          showToast("Group renamed");
        },
        onError: () => showToast("Couldn't rename — try again")
      }
    );
  };

  const confirmLeave = () => {
    appAlert("Leave this group?", "You'll stop receiving its messages. You can only rejoin if someone adds you back.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          leaveGroup.mutate(conversationId, {
            onSuccess: () => {
              showToast("Left the group");
              // Pop past the chat screen too — it no longer exists for us.
              router.navigate("/(tabs)/friends");
            },
            onError: () => showToast("Couldn't leave — try again")
          })
      }
    ]);
  };

  const openReport = () => {
    // Groups report the conversation; 1:1 reports the person.
    sheet.open(
      isGroup ? (
        <ReportSheet contentType="conversation" contentId={conversationId} label="chat" reportedUserId={null} />
      ) : (
        <ReportSheet contentType="user" contentId={peer as string} label="user" reportedUserId={peer as string} />
      )
    );
  };

  const toggleBlock = () => {
    if (!peer) return;
    const m = peerBlocked ? unblockUser : blockUser;
    m.mutate(peer, { onSuccess: () => showToast(peerBlocked ? "Unblocked" : "Blocked") });
  };

  const peerName = peerProfile.data?.display_name ?? "Chat";
  const title = isGroup ? displayName : peerName;
  const sub = isGroup
    ? `${members.length} members`
    : peerProfile.data?.username
      ? `@${peerProfile.data.username}`
      : undefined;
  const headerAvatarUri = isGroup ? null : (peerProfile.data?.avatar_url ?? null);

  /* ------------------------------ add people ------------------------------ */
  if (adding) {
    const toggle = (id: string) =>
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= roomLeft ? prev : [...prev, id]
      );
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader
          title="Add people"
          sub={`${members.length}/${MAX_MEMBERS} members`}
          onBack={() => setAdding(false)}
        />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
          {addable.length === 0 ? (
            <EmptyState title="All your friends are already here." center />
          ) : (
            addable.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                selected={selected.includes(friend.id)}
                onPress={() => toggle(friend.id)}
              />
            ))
          )}
        </ScrollView>
        <View style={{ position: "absolute", left: space[4], right: space[4], bottom: insets.bottom + space[4] }}>
          <Button
            onPress={() => {
              if (selected.length === 0 || addMembers.isPending) return;
              addMembers.mutate(
                { conversationId, memberIds: selected },
                {
                  onSuccess: () => {
                    showToast(selected.length === 1 ? "Added to the group" : `${selected.length} people added`);
                    setSelected([]);
                    setAdding(false);
                  },
                  onError: () => showToast("Couldn't add — try again")
                }
              );
            }}
            disabled={selected.length === 0 || addMembers.isPending}
            loading={addMembers.isPending}
          >
            {selected.length ? `Add ${selected.length}` : "Add"}
          </Button>
        </View>
      </View>
    );
  }

  /* ------------------------------- details ------------------------------- */
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title} sub={sub} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}
      >
        <View style={{ alignItems: "center", paddingTop: space[2] }}>
          <Avatar name={title || "?"} uri={headerAvatarUri} size={84} />
        </View>
        {isGroup ? (
          <>
            <View
              style={{
                paddingHorizontal: space[4],
                paddingTop: space[4],
                flexDirection: "row",
                alignItems: "center",
                gap: space[2]
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setNameDraft}
                onSubmitEditing={saveName}
                maxLength={40}
                returnKeyType="done"
                placeholder={`Group name · ${displayName}`}
                placeholderTextColor={tokens.text.tertiary}
                accessibilityLabel="Group name"
                style={{
                  flex: 1,
                  backgroundColor: tokens.bg.raised,
                  borderWidth: 1,
                  borderColor: tokens.border.default,
                  borderRadius: radius.sm,
                  height: 44,
                  paddingHorizontal: space[3] + 2,
                  fontSize: 15,
                  color: colors.bone,
                  fontFamily: "Geist_400Regular"
                }}
              />
              {nameDirty && draft.trim() ? (
                <Pressable
                  onPress={saveName}
                  haptic="none"
                  accessibilityLabel="Save group name"
                  disabled={renameGroup.isPending}
                  style={{ paddingHorizontal: space[2], paddingVertical: space[2] }}
                >
                  <Text variant="meta-strong" className="text-white">
                    {renameGroup.isPending ? "…" : "Save"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text variant="meta" className="px-4 pt-[6px]">
              Anyone in the group can change the name.
            </Text>
          </>
        ) : null}

        {isGroup ? (
          <>
            <Section>{`Members · ${members.length}`}</Section>
            {addable.length > 0 && roomLeft > 0 ? (
              <View style={{ paddingHorizontal: space[4] }}>
                <SettingNavRow
                  icon={<UserPlus size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
                  title="Add people"
                  onPress={() => setAdding(true)}
                />
              </View>
            ) : null}
            {groupInfo.isLoading ? (
              <View style={{ paddingHorizontal: space[4], gap: space[2] + 2, paddingTop: space[1] + 2 }}>
                <Skeleton height={40} radius={radius.sm} />
                <Skeleton height={40} radius={radius.sm} />
              </View>
            ) : (
              members.map((member) => (
                <UserRow
                  key={member.id}
                  name={member.id === userId ? `${member.name} (you)` : member.name}
                  avatarUrl={member.avatarUrl}
                  sub={`@${member.username}`}
                  onPress={member.id === userId ? undefined : () => router.push(`/user/${member.username}`)}
                />
              ))
            )}
          </>
        ) : (
          <>
            <Section>Profile</Section>
            <UserRow
              name={peerName}
              avatarUrl={peerProfile.data?.avatar_url ?? null}
              sub={peerProfile.data?.username ? `@${peerProfile.data.username}` : undefined}
              onPress={
                peerProfile.data?.username ? () => router.push(`/user/${peerProfile.data?.username}`) : undefined
              }
            />
          </>
        )}

        {/* Media — every photo/video sent in the chat. */}
        <Section>Media</Section>
        {media.isLoading ? (
          <View style={{ flexDirection: "row", gap: 2, paddingHorizontal: space[4] }}>
            <Skeleton width={cellW} height={cellW} radius={6} />
            <Skeleton width={cellW} height={cellW} radius={6} />
            <Skeleton width={cellW} height={cellW} radius={6} />
          </View>
        ) : (media.data?.length ?? 0) === 0 ? (
          <Text variant="meta" className="px-4">
            Photos and videos sent in this chat show up here.
          </Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingHorizontal: space[4] }}>
            {(media.data ?? []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setViewer(item)}
                accessibilityLabel={item.kind === "video" ? "Open video" : "Open photo"}
                haptic="none"
              >
                <View
                  style={{
                    width: cellW,
                    height: cellW,
                    borderRadius: 6,
                    overflow: "hidden",
                    backgroundColor: tokens.bg.raised
                  }}
                >
                  {item.kind === "image" ? (
                    <Image source={{ uri: item.uri }} contentFit="cover" style={{ flex: 1 }} transition={80} />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: radius.pill,
                          backgroundColor: colors.hairlineStrong,
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <Play size={15} color={colors.white} fill={colors.white} strokeWidth={0} />
                      </View>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Section>Options</Section>
        <View style={{ paddingHorizontal: space[2] }}>
          <MenuRow
            icon={
              muted.data ? (
                <Bell size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
              ) : (
                <BellOff size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
              )
            }
            label={muted.data ? "Unmute notifications" : "Mute notifications"}
            onPress={() => setMuted.mutate(!(muted.data ?? false))}
          />
          {!isGroup ? (
            <MenuRow
              icon={
                <Ban
                  size={icon.size.sm}
                  color={peerBlocked ? tokens.text.primary : tokens.status.danger}
                  strokeWidth={icon.stroke.regular}
                />
              }
              label={peerBlocked ? "Unblock" : "Block"}
              destructive={!peerBlocked}
              onPress={toggleBlock}
            />
          ) : null}
          <MenuRow
            icon={<Flag size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />}
            label={isGroup ? "Report chat" : "Report"}
            onPress={openReport}
          />
          {isGroup ? (
            <MenuRow
              icon={<LogOut size={icon.size.sm} color={tokens.status.danger} strokeWidth={icon.stroke.regular} />}
              label="Leave group"
              destructive
              onPress={confirmLeave}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Full-screen media viewer — a system modal by design (covers navigation chrome). */}
      <Modal
        visible={Boolean(viewer)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: colors.black }}>
          {viewer?.kind === "image" ? (
            <Image source={{ uri: viewer.uri }} contentFit="contain" style={{ flex: 1 }} transition={100} />
          ) : viewer ? (
            <VideoViewerBody uri={viewer.uri} />
          ) : null}
          <IconButton
            variant="plain"
            icon={<X size={icon.size.sm} color={colors.white} strokeWidth={icon.stroke.bold} />}
            accessibilityLabel="Close"
            onPress={() => setViewer(null)}
            style={{ position: "absolute", top: insets.top + space[2], right: space[3] }}
          />
        </View>
      </Modal>
    </View>
  );
}
