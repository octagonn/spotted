import { Image } from "expo-image";
import { appAlert } from "@/components/ui/AppDialog";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, Check, Copy, Flag, Globe, KeyRound, Lock, LogOut, Pencil, RefreshCw, Shield, Users, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { ReportSheet } from "@/components/ReportSheet";
import { useSheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonHeaderDetail, SkeletonRows } from "@/components/ui/Skeleton";
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
import { compressReactionSelfie } from "@/lib/posts";
import { logger } from "@/lib/logger";
import { uploadMediaObject } from "@/lib/r2";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

const NAME_MAX = 126;
const DESC_MAX = 1251;

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
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
    sheet.open(<ReportSheet contentType="community" contentId={id} label="community" reportedUserId={community.data?.createdBy ?? undefined} />);
  };

  if (community.isLoading || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <SkeletonHeaderDetail />
        <View style={{ paddingHorizontal: 18, gap: 14 }}>
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
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          Join the community to manage its settings.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.black }}
    >
      <PanelHeader title="Community settings" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 28 }}
      >
        {/* ---- Member settings (everyone) ---- */}
        <SettingRow
          icon={<Bell size={17} color={colors.silver} strokeWidth={2} />}
          label="Notifications"
          sub={muted.data ? "Muted — no posts or chat alerts" : "On for posts and chat"}
          right={<Toggle value={!(muted.data ?? false)} onToggle={() => setMuted.mutate(!(muted.data ?? false))} />}
        />

        {isPrivate ? (
          <SettingRow
            icon={<KeyRound size={17} color={colors.silver} strokeWidth={2} />}
            label="Invite code"
            sub="Anyone with this code can join directly"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text selectable style={{ fontFamily: "GeistMono_500Medium", fontSize: 14, letterSpacing: 2, color: tokens.accent.gold }}>
                  {inviteCode.data ?? "———"}
                </Text>
                {isAdmin ? (
                  <Pressable
                    accessibilityLabel="Regenerate invite code"
                    hitSlop={8}
                    onPress={() =>
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
                      ])
                    }
                  >
                    <RefreshCw size={15} color={colors.fog} strokeWidth={2} />
                  </Pressable>
                ) : (
                  <Copy size={14} color={colors.fog} strokeWidth={2} />
                )}
              </View>
            }
          />
        ) : null}

        {/* ---- Managers: roles & members (Discord-style permissions) ---- */}
        {perms.manage_roles ? (
          <SettingRow
            icon={<Shield size={17} color={colors.silver} strokeWidth={2} />}
            label="Roles"
            sub="Who can chat, post, invite, and manage"
            onPress={() => router.push(`/community/${id}/roles` as never)}
          />
        ) : null}
        {perms.manage_members ? (
          <SettingRow
            icon={<Users size={17} color={colors.silver} strokeWidth={2} />}
            label="Members"
            sub="Assign roles or remove members"
            onPress={() => router.push(`/community/${id}/members` as never)}
          />
        ) : null}

        <SettingRow
          icon={<Flag size={17} color={colors.silver} strokeWidth={2} />}
          label="Report community"
          sub="Flag this community for review"
          onPress={openReport}
        />
        <SettingRow
          icon={<LogOut size={17} color="#EF4444" strokeWidth={2} />}
          label="Leave community"
          labelColor="#EF4444"
          sub={isCreator ? "You created this community" : undefined}
          onPress={confirmLeave}
        />

        {/* ---- Managers: pending join requests (private) ---- */}
        {perms.manage_members && isPrivate ? (
          <>
            <SectionTitle>Join requests</SectionTitle>
            {(requests.data ?? []).length === 0 ? (
              requests.isLoading ? (
                <SkeletonRows count={3} />
              ) : (
                <Text style={{ paddingBottom: 8, fontSize: 12.5, color: colors.fog }}>
                  No pending requests.
                </Text>
              )
            ) : (
              (requests.data ?? []).map((request) => (
                <View key={request.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}>
                  <Avatar name={request.profile?.display_name ?? "?"} uri={request.profile?.avatar_url} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                      {request.profile?.display_name ?? "Someone"}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.fog }}>@{request.profile?.username ?? "unknown"}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Approve request"
                    onPress={() => respond.mutate({ userId: request.user_id, accept: true })}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}
                  >
                    <Check size={17} color={colors.black} strokeWidth={2.6} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Decline request"
                    onPress={() => respond.mutate({ userId: request.user_id, accept: false })}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={16} color={colors.fog} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ))
            )}
          </>
        ) : null}

        {/* ---- Admin: edit community ---- */}
        {isAdmin ? (
          <>
            <SectionTitle>Edit community</SectionTitle>
            <View style={{ alignItems: "center", paddingTop: 4 }}>
              <Pressable onPress={() => void pickPhoto()} accessibilityLabel="Community photo">
                <View style={{ width: 100, height: 100, borderRadius: 20, overflow: "hidden", backgroundColor: colors.graphite, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                  {photoPreview ? (
                    <Image source={{ uri: photoPreview }} contentFit="cover" style={{ width: 100, height: 100 }} />
                  ) : (
                    <Pencil size={22} color={colors.fog} strokeWidth={2} />
                  )}
                  {uploading ? (
                    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View style={{ position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.black, alignItems: "center", justifyContent: "center" }}>
                  <Pencil size={14} color={colors.black} strokeWidth={2.2} />
                </View>
              </Pressable>
            </View>

            <Label>Name</Label>
            <TextInput value={name} onChangeText={(v) => setName(v.slice(0, NAME_MAX))} maxLength={NAME_MAX} accessibilityLabel="Community name" placeholder="Community name" placeholderTextColor={colors.fog} style={inputStyle} />
            <Counter value={name.length} max={NAME_MAX} />

            <Label>Description</Label>
            <TextInput value={description} onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))} maxLength={DESC_MAX} multiline textAlignVertical="top" accessibilityLabel="Community description" placeholder="What's this community about?" placeholderTextColor={colors.fog} style={[inputStyle, { minHeight: 92, paddingTop: 12 }]} />
            <Counter value={description.length} max={DESC_MAX} />

            <Label>Privacy</Label>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PrivacyPill active={privacy === "public"} onPress={() => setPrivacy("public")} icon={<Globe size={14} color={privacy === "public" ? colors.black : colors.silver} strokeWidth={2} />} label="Public" />
              <PrivacyPill active={privacy === "private"} onPress={() => setPrivacy("private")} icon={<Lock size={14} color={privacy === "private" ? colors.black : colors.silver} strokeWidth={2} />} label="Private" />
            </View>

            <Label>Location</Label>
            <TextInput value={location} onChangeText={setLocation} accessibilityLabel="Community location" placeholder="City, State — leave blank for global" placeholderTextColor={colors.fog} style={inputStyle} />

            <View style={{ paddingTop: 24 }}>
              <Button loading={update.isPending} disabled={update.isPending} onPress={save}>
                Save changes
              </Button>
            </View>

            {/* ---- Danger zone: creator-only permanent deletion (6b) ---- */}
            {isCreator ? (
              <View style={{ marginTop: 34, borderWidth: 1, borderColor: "rgba(229,72,77,0.4)", borderRadius: 16, padding: 16 }}>
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: "#E5484D" }}>Delete community</Text>
                <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 18, color: colors.fog }}>
                  Permanent. Removes the community, its chat, and its memberships for every member. Posts stay on their owners&apos; profiles.
                </Text>
                {!deleteArmed ? (
                  <Pressable
                    accessibilityLabel="Delete community"
                    onPress={() => setDeleteArmed(true)}
                    style={{ marginTop: 14, alignSelf: "flex-start", borderWidth: 1, borderColor: "#E5484D", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 }}
                  >
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: "#E5484D" }}>Delete…</Text>
                  </Pressable>
                ) : (
                  <>
                    <Text style={{ marginTop: 14, fontSize: 12.5, color: colors.silver }}>
                      Type <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>{community.data?.name ?? ""}</Text> to confirm:
                    </Text>
                    <TextInput
                      value={deleteDraft}
                      onChangeText={setDeleteDraft}
                      autoFocus
                      autoCapitalize="none"
                      placeholder="Community name"
                      placeholderTextColor={colors.fog}
                      style={[inputStyle, { marginTop: 8, borderColor: "rgba(229,72,77,0.5)" }]}
                    />
                    <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                      <Pressable
                        accessibilityLabel="Confirm delete community"
                        disabled={deleteDraft.trim() !== (community.data?.name ?? "").trim() || deleteCommunity.isPending}
                        onPress={() =>
                          deleteCommunity.mutate(id as string, {
                            onSuccess: () => {
                              showToast("Community deleted");
                              router.replace("/(tabs)/map");
                            },
                            onError: () => showToast("Couldn't delete — try again")
                          })
                        }
                        style={{
                          borderRadius: 999,
                          paddingVertical: 9,
                          paddingHorizontal: 18,
                          backgroundColor:
                            deleteDraft.trim() === (community.data?.name ?? "").trim() ? "#E5484D" : "rgba(229,72,77,0.25)"
                        }}
                      >
                        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: colors.white }}>
                          {deleteCommunity.isPending ? "Deleting…" : "Delete forever"}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel="Cancel delete"
                        onPress={() => {
                          setDeleteArmed(false);
                          setDeleteDraft("");
                        }}
                        style={{ borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.iron }}
                      >
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.silver }}>Cancel</Text>
                      </Pressable>
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

function SettingRow({
  icon,
  label,
  labelColor,
  sub,
  right,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.graphite }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: labelColor ?? colors.white }}>{label}</Text>
        {sub ? <Text style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      {body}
    </Pressable>
  );
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onToggle}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 3,
        justifyContent: "center",
        borderColor: value ? colors.white : colors.slate,
        backgroundColor: value ? colors.white : colors.graphite
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignSelf: value ? "flex-end" : "flex-start",
          backgroundColor: value ? colors.black : colors.mist
        }}
      />
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={{ paddingTop: 26, paddingBottom: 10, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, textTransform: "uppercase", color: colors.fog }}>
      {children}
    </Text>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={{ paddingTop: 18, paddingBottom: 8, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.12, textTransform: "uppercase", color: colors.fog }}>
      {children}
    </Text>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <Text style={{ alignSelf: "flex-end", paddingTop: 6, fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.fog }}>
      {value}/{max}
    </Text>
  );
}

function PrivacyPill({ active, onPress, icon, label }: { active: boolean; onPress: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} accessibilityState={{ selected: active }} style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: active ? colors.white : colors.iron, backgroundColor: active ? colors.white : colors.graphite }}>
        {icon}
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: active ? colors.black : colors.silver }}>{label}</Text>
      </View>
    </Pressable>
  );
}

const inputStyle = {
  minHeight: 46,
  borderWidth: 1,
  borderColor: colors.iron,
  borderRadius: 12,
  backgroundColor: colors.graphite,
  paddingHorizontal: 14,
  fontSize: 15,
  color: colors.white
} as const;
