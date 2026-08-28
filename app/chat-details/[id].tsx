import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ban, Bell, BellOff, Flag, LogOut, Play, UserPlus, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";

import { appAlert } from "@/components/ui/AppDialog";
import { ReportSheet } from "@/components/ReportSheet";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
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

const MAX_MEMBERS = 16;

/**
 * Full-screen conversation details (IG/iMessage-style), opened by tapping the
 * name in the chat header. Groups: rename at the top (ANY member may rename,
 * like Snapchat), members with add-people, media gallery, mute / report /
 * leave. 1:1 (`?peer=<profileId>`): the person, media gallery, mute / block /
 * report — the only home for these since the chat's ⋯ menu was removed.
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

  const cellW = Math.floor((winW - 16 * 2 - 2 * 2) / 3);

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
    // Groups report the conversation; 1:1 reports the person (matches the old
    // ⋯ menu semantics).
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
        <PanelHeader title="Add people" sub={`${members.length}/${MAX_MEMBERS} members`} onBack={() => setAdding(false)} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
          {addable.length === 0 ? (
            <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
              All your friends are already here.
            </Text>
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
        <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 16 }}>
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
          >
            {addMembers.isPending ? "Adding…" : selected.length ? `Add ${selected.length}` : "Add"}
          </Button>
        </View>
      </View>
    );
  }

  /* ------------------------------- details ------------------------------- */
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title} sub={sub} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        {/* Identity: big avatar; groups add rename (any member can rename). */}
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <Avatar name={title || "?"} uri={headerAvatarUri} size={84} />
        </View>
        {isGroup ? (
        <>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setNameDraft}
            onSubmitEditing={saveName}
            maxLength={40}
            returnKeyType="done"
            placeholder={`Group name · ${displayName}`}
            placeholderTextColor={colors.ash}
            accessibilityLabel="Group name"
            style={{
              flex: 1,
              backgroundColor: colors.charcoal,
              borderWidth: 1,
              borderColor: colors.iron,
              borderRadius: 12,
              paddingVertical: 11,
              paddingHorizontal: 14,
              fontSize: 15,
              color: colors.bone,
              fontFamily: "Geist_400Regular"
            }}
          />
          {nameDirty && draft.trim() ? (
            <Pressable onPress={saveName} accessibilityLabel="Save group name" disabled={renameGroup.isPending}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13.5, color: colors.white, paddingHorizontal: 6, paddingVertical: 10 }}>
                {renameGroup.isPending ? "…" : "Save"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ paddingHorizontal: 20, paddingTop: 6, fontSize: 11.5, color: colors.fog }}>
          Anyone in the group can change the name.
        </Text>
        </>
        ) : null}

        {/* Members (groups) / the person (1:1). */}
        {isGroup ? (
          <>
            <SectionHeading>{`Members · ${members.length}`}</SectionHeading>
            {addable.length > 0 && roomLeft > 0 ? (
              <Pressable onPress={() => setAdding(true)} accessibilityLabel="Add people">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 20 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                    <UserPlus size={18} color={colors.white} strokeWidth={2} />
                  </View>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>Add people</Text>
                </View>
              </Pressable>
            ) : null}
            {groupInfo.isLoading ? (
              <View style={{ paddingHorizontal: 20, gap: 10, paddingTop: 6 }}>
                <Skeleton height={40} radius={12} />
                <Skeleton height={40} radius={12} />
              </View>
            ) : (
              members.map((member) => (
                <ChoiceRow
                  key={member.id}
                  title={member.id === userId ? `${member.name} (you)` : member.name}
                  sub={`@${member.username}`}
                  left={<Avatar name={member.name} uri={member.avatarUrl} size={40} />}
                  onPress={member.id === userId ? undefined : () => router.push(`/user/${member.username}`)}
                />
              ))
            )}
          </>
        ) : (
          <>
            <SectionHeading>Profile</SectionHeading>
            <ChoiceRow
              title={peerName}
              sub={peerProfile.data?.username ? `@${peerProfile.data.username}` : undefined}
              left={<Avatar name={peerName} uri={peerProfile.data?.avatar_url ?? null} size={40} />}
              onPress={peerProfile.data?.username ? () => router.push(`/user/${peerProfile.data?.username}`) : undefined}
            />
          </>
        )}

        {/* Media — every photo/video sent in the chat (iMessage-style). */}
        <SectionHeading>Media</SectionHeading>
        {media.isLoading ? (
          <View style={{ flexDirection: "row", gap: 2, paddingHorizontal: 16 }}>
            <Skeleton width={cellW} height={cellW} radius={6} />
            <Skeleton width={cellW} height={cellW} radius={6} />
            <Skeleton width={cellW} height={cellW} radius={6} />
          </View>
        ) : (media.data?.length ?? 0) === 0 ? (
          <Text style={{ paddingHorizontal: 20, fontSize: 12.5, color: colors.fog }}>
            Photos and videos sent in this chat show up here.
          </Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingHorizontal: 16 }}>
            {(media.data ?? []).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setViewer(item)}
                accessibilityLabel={item.kind === "video" ? "Open video" : "Open photo"}
                haptic={false}
              >
                <View style={{ width: cellW, height: cellW, borderRadius: 6, overflow: "hidden", backgroundColor: colors.graphite }}>
                  {item.kind === "image" ? (
                    <Image source={{ uri: item.uri }} contentFit="cover" style={{ flex: 1 }} transition={80} />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                        <Play size={15} color={colors.white} fill={colors.white} strokeWidth={0} />
                      </View>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Actions */}
        <SectionHeading>Options</SectionHeading>
        <ActionRow
          icon={
            muted.data ? (
              <Bell size={18} color={colors.white} strokeWidth={2} />
            ) : (
              <BellOff size={18} color={colors.white} strokeWidth={2} />
            )
          }
          label={muted.data ? "Unmute notifications" : "Mute notifications"}
          onPress={() => setMuted.mutate(!(muted.data ?? false))}
        />
        {!isGroup ? (
          <ActionRow
            icon={<Ban size={18} color={peerBlocked ? colors.white : "#EF4444"} strokeWidth={2} />}
            label={peerBlocked ? "Unblock" : "Block"}
            destructive={!peerBlocked}
            onPress={toggleBlock}
          />
        ) : null}
        <ActionRow
          icon={<Flag size={18} color={colors.white} strokeWidth={2} />}
          label={isGroup ? "Report chat" : "Report"}
          onPress={openReport}
        />
        {isGroup ? (
          <ActionRow
            icon={<LogOut size={18} color="#EF4444" strokeWidth={2} />}
            label="Leave group"
            destructive
            onPress={confirmLeave}
          />
        ) : null}
      </ScrollView>

      {/* Full-screen media viewer. */}
      <Modal visible={Boolean(viewer)} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
          {viewer?.kind === "image" ? (
            <Image source={{ uri: viewer.uri }} contentFit="contain" style={{ flex: 1 }} transition={100} />
          ) : viewer ? (
            <VideoViewerBody uri={viewer.uri} />
          ) : null}
          <Pressable
            onPress={() => setViewer(null)}
            accessibilityLabel="Close"
            hitSlop={10}
            style={{ position: "absolute", top: insets.top + 10, right: 16 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
              <X size={18} color={colors.white} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function VideoViewerBody({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />;
}

function SectionHeading({ children }: { children: string }) {
  return (
    <Text
      style={{
        paddingHorizontal: 20,
        paddingTop: 26,
        paddingBottom: 10,
        fontFamily: "GeistMono_400Regular",
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: colors.mist
      }}
    >
      {children}
    </Text>
  );
}

function ActionRow({
  icon,
  label,
  destructive,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 20 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: destructive ? "#EF4444" : colors.white }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
