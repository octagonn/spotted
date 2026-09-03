import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, Copy, Flag, LogOut, Pencil, RefreshCw, Shield, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { JoinRequestRow } from "@/components/communities/MemberRow";
import { ReportSheet } from "@/components/ReportSheet";
import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Segmented } from "@/components/ui/Segmented";
import { SettingNavRow, SettingRow, SettingSectionLabel, SettingToggle } from "@/components/ui/SettingRow";
import { useSheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonHeaderDetail, SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import {
  NO_PERMISSIONS,
  useCommunity,
  useCommunityInviteCode,
  useCommunityJoinRequests,
  useCommunityMuted,
  useDeleteCommunity,
  useLeaveCommunity,
  useRegenerateInviteCode,
  useRespondJoinRequest,
  useSetCommunityMuted,
  useUpdateCommunity
} from "@/hooks/queries/useCommunities";
import { logger } from "@/lib/logger";
import { compressReactionSelfie } from "@/lib/posts";
import { uploadMediaObject } from "@/lib/r2";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

const NAME_MAX = 126;
const DESC_MAX = 1251;
const GUTTER = space[4] + 2;
const PRIVACY_OPTIONS = ["Public", "Private"];

const glyph = (Icon: typeof Bell, color = colors.silver) => (
  <Icon size={icon.size.xs + 1} color={color} strokeWidth={icon.stroke.regular} />
);

export default function CommunitySettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const userId = useAuthStore((state) => state.userId);
  const community = useCommunity(id);
  const update = useUpdateCommunity(id);
  const leave = useLeaveCommunity();
  const deleteCommunity = useDeleteCommunity();
  // Type-the-name confirmation for deletion (deliberate, hard to fat-finger).
  const [deleteDraft, setDeleteDraft] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  const isMember = community.data?.isMember ?? false;
  const isAdmin = community.data?.isAdmin ?? false;
  const isPrivate = community.data?.privacy === "private";
  const isCreator = Boolean(userId) && community.data?.createdBy === userId;
  const perms = community.data?.perms ?? NO_PERMISSIONS;

  // Member prefs + invite code (spec 18/19).
  const muted = useCommunityMuted(isMember ? id : undefined);
  const setMuted = useSetCommunityMuted(id);
  const inviteCode = useCommunityInviteCode(id, isMember && isPrivate);
  const regenerate = useRegenerateInviteCode(id);

  // Admin: pending join requests (spec 17/18).
  const requests = useCommunityJoinRequests(id, perms.manage_members && isPrivate);
  const respond = useRespondJoinRequest(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [location, setLocation] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (community.data && !hydrated) {
      setName(community.data.name);
      setDescription(community.data.description ?? "");
      setPrivacy(community.data.privacy);
      setLocation(community.data.location ?? "");
      setPhotoUrl(community.data.photoUrl);
      setPhotoPreview(community.data.photoUrl);
      setHydrated(true);
    }
  }, [community.data, hydrated]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });
    if (result.canceled || !result.assets[0] || !userId) return;
    setPhotoPreview(result.assets[0].uri);
    setUploading(true);
    try {
      const compressed = await compressReactionSelfie(result.assets[0].uri);
      const body = await (await fetch(compressed)).arrayBuffer();
      if (!body || body.byteLength === 0) throw new Error("empty");
      setPhotoUrl(await uploadMediaObject(`${userId}/community-${Date.now()}.jpg`, body, "image/jpeg"));
    } catch (error) {
      logger.warn("community_photo_failed", { message: error instanceof Error ? error.message : String(error) });
      showToast("Couldn't upload photo — try again");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (name.trim().length < 2) {
      showToast("Give it a name (2+ characters)");
      return;
    }
    update.mutate(
      { name, description, privacy, location, photoUrl },
      {
        onSuccess: () => {
          showToast("Saved");
          router.back();
        },
        onError: () => showToast("Couldn't save — try again")
      }
    );
  };

  const confirmLeave = () => {
    if (isCreator) {
      showToast("Creators can't leave their own community yet");
      return;
    }
    appAlert("Leave community", `Leave ${community.data?.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          leave.mutate(id as string, {
            onSuccess: () => {
              showToast("Left the community");
              router.back();
            },
            onError: () => showToast("Couldn't leave — try again")
          })
      }
    ]);
  };

  const openReport = () => {
    if (!id) return;
    sheet.open(
      <ReportSheet
        contentType="community"
        contentId={id}
        label="community"
        reportedUserId={community.data?.createdBy ?? undefined}
      />
    );
  };

  const confirmRegenerate = () =>
    appAlert("Regenerate code", "The old code stops working immediately.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Regenerate",
        onPress: () =>
          regenerate.mutate(undefined, {
            onSuccess: () => showToast("New code generated"),
            onError: () => showToast("Couldn't regenerate — try again")
          })
      }
    ]);

  if (community.isLoading || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <SkeletonHeaderDetail />
        <View style={{ paddingHorizontal: GUTTER, gap: space[3] + 2 }}>
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
        </View>
      </View>
    );
  }
  if (!isMember) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Settings" />
        <Text variant="meta" className="pt-10 text-center">
          Join the community to manage its settings.
        </Text>
      </View>
    );
  }

  const deleteMatches = deleteDraft.trim() === (community.data?.name ?? "").trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.black }}
    >
      <PanelHeader title="Community settings" sub={community.data?.name} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + space[6] + 4 }}
      >
        {/* ---- Member settings (everyone) ---- */}
        <SettingRow
          title="Notifications"
          sub={muted.data ? "Muted — no posts or chat alerts" : "On for posts and chat"}
          right={
            <SettingToggle value={!(muted.data ?? false)} onToggle={() => setMuted.mutate(!(muted.data ?? false))} />
          }
        />

        {isPrivate ? (
          <SettingRow
            title="Invite code"
            sub="Anyone with this code can join directly"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <Text variant="numeral-sm" selectable className="tracking-[2px] text-gold">
                  {inviteCode.data ?? "———"}
                </Text>
                {isAdmin ? (
                  <IconButton
                    variant="plain"
                    size={32}
                    icon={glyph(RefreshCw, tokens.text.tertiary)}
                    accessibilityLabel="Regenerate invite code"
                    onPress={confirmRegenerate}
                  />
                ) : (
                  glyph(Copy, tokens.text.tertiary)
                )}
              </View>
            }
          />
        ) : null}

        {/* ---- Managers: roles & members (Discord-style permissions) ---- */}
        {perms.manage_roles ? (
          <SettingNavRow
            icon={glyph(Shield)}
            title="Roles"
            sub="Who can chat, post, invite, and manage"
            onPress={() => router.push(`/community/${id}/roles` as never)}
          />
        ) : null}
        {perms.manage_members ? (
          <SettingNavRow
            icon={glyph(Users)}
            title="Members"
            sub="Assign roles or remove members"
            onPress={() => router.push(`/community/${id}/members` as never)}
          />
        ) : null}

        <SettingNavRow
          icon={glyph(Flag)}
          title="Report community"
          sub="Flag this community for review"
          onPress={openReport}
        />
        <SettingNavRow
          icon={glyph(LogOut, tokens.status.danger)}
          title="Leave community"
          danger
          sub={isCreator ? "You created this community" : undefined}
          onPress={confirmLeave}
        />

        {/* ---- Managers: pending join requests (private) ---- */}
        {perms.manage_members && isPrivate ? (
          <>
            <SettingSectionLabel>Join requests</SettingSectionLabel>
            {(requests.data ?? []).length === 0 ? (
              requests.isLoading ? (
                <SkeletonRows count={3} />
              ) : (
                <Text variant="meta" className="pb-2">
                  No pending requests.
                </Text>
              )
            ) : (
              <View style={{ marginHorizontal: -GUTTER }}>
                {(requests.data ?? []).map((request) => (
                  <JoinRequestRow
                    key={request.user_id}
                    name={request.profile?.display_name ?? "Someone"}
                    username={request.profile?.username ?? "unknown"}
                    avatarUrl={request.profile?.avatar_url}
                    onApprove={() => respond.mutate({ userId: request.user_id, accept: true })}
                    onDeny={() => respond.mutate({ userId: request.user_id, accept: false })}
                  />
                ))}
              </View>
            )}
          </>
        ) : null}

        {/* ---- Admin: edit community ---- */}
        {isAdmin ? (
          <>
            <SettingSectionLabel>Edit community</SettingSectionLabel>
            <View style={{ alignItems: "center", paddingTop: space[1] }}>
              <Pressable onPress={() => void pickPhoto()} accessibilityLabel="Community photo" haptic="none">
                <View
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: radius.md + 4,
                    overflow: "hidden",
                    backgroundColor: tokens.bg.raised,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {photoPreview ? (
                    <Image source={{ uri: photoPreview }} contentFit="cover" style={{ width: 100, height: 100 }} />
                  ) : (
                    <Pencil size={icon.size.sm + 2} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
                  )}
                  {uploading ? (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: tokens.bg.scrim,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <ActivityIndicator color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.white,
                    borderWidth: 3,
                    borderColor: colors.black,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Pencil size={icon.size.xs - 2} color={colors.black} strokeWidth={icon.stroke.bold} />
                </View>
              </Pressable>
            </View>

            <FieldLabel>Name</FieldLabel>
            <TextField
              value={name}
              onChangeText={(v) => setName(v.slice(0, NAME_MAX))}
              maxLength={NAME_MAX}
              accessibilityLabel="Community name"
              placeholder="Community name"
              counter
            />

            <FieldLabel>Description</FieldLabel>
            <TextField
              value={description}
              onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))}
              maxLength={DESC_MAX}
              multiline
              accessibilityLabel="Community description"
              placeholder="What's this community about?"
              counter
            />

            <FieldLabel>Privacy</FieldLabel>
            <Segmented
              options={PRIVACY_OPTIONS}
              value={privacy === "public" ? "Public" : "Private"}
              onChange={(v) => setPrivacy(v === "Private" ? "private" : "public")}
              style={{ marginTop: 0 }}
            />

            <FieldLabel>Location</FieldLabel>
            <TextField
              value={location}
              onChangeText={setLocation}
              accessibilityLabel="Community location"
              placeholder="City, State — leave blank for global"
            />

            <View style={{ paddingTop: space[6] }}>
              <Button loading={update.isPending} disabled={update.isPending} onPress={save}>
                Save changes
              </Button>
            </View>

            {/* ---- Danger zone: creator-only permanent deletion (6b) ---- */}
            {isCreator ? (
              <View style={{ marginTop: space[8] + 2 }}>
                <SettingSectionLabel>Danger zone</SettingSectionLabel>
                <Text variant="username" className="text-danger">
                  Delete community
                </Text>
                <Text variant="meta" className="mt-[6px]">
                  Permanent. Removes the community, its chat, and its memberships for every member. Posts stay on their
                  owners&apos; profiles.
                </Text>
                {!deleteArmed ? (
                  <View style={{ marginTop: space[3] + 2, alignSelf: "flex-start" }}>
                    <Button variant="danger" onPress={() => setDeleteArmed(true)} accessibilityLabel="Delete community">
                      Delete…
                    </Button>
                  </View>
                ) : (
                  <>
                    <Text variant="meta" className="mt-[14px] text-silver">
                      Type{" "}
                      <Text variant="meta-strong" className="text-white">
                        {community.data?.name ?? ""}
                      </Text>{" "}
                      to confirm:
                    </Text>
                    <TextField
                      value={deleteDraft}
                      onChangeText={setDeleteDraft}
                      autoFocus
                      autoCapitalize="none"
                      placeholder="Community name"
                      accessibilityLabel="Type the community name to confirm"
                      containerStyle={{ marginTop: space[2] }}
                    />
                    <View style={{ marginTop: space[3], flexDirection: "row", gap: space[2] + 2 }}>
                      <Button
                        variant="danger-solid"
                        style={{ flex: 1 }}
                        accessibilityLabel="Confirm delete community"
                        disabled={!deleteMatches || deleteCommunity.isPending}
                        loading={deleteCommunity.isPending}
                        onPress={() =>
                          deleteCommunity.mutate(id as string, {
                            onSuccess: () => {
                              showToast("Community deleted");
                              router.replace("/(tabs)/map");
                            },
                            onError: () => showToast("Couldn't delete — try again")
                          })
                        }
                      >
                        Delete forever
                      </Button>
                      <Button
                        variant="ghost"
                        style={{ flex: 1 }}
                        accessibilityLabel="Cancel delete"
                        onPress={() => {
                          setDeleteArmed(false);
                          setDeleteDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                    </View>
                  </>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="micro" className="pb-2 pt-[18px]">
      {children}
    </Text>
  );
}
