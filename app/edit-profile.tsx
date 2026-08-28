import { useQueryClient } from "@tanstack/react-query";
import { appAlert } from "@/components/ui/AppDialog";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera, ChevronRight, MapPin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HomeGymSheet } from "@/components/profile/HomeGymSheet";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { useSheet } from "@/components/ui/Sheet";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { compressReactionSelfie } from "@/lib/posts";
import { logger } from "@/lib/logger";
import { parseSocialLinks, SOCIAL_PLATFORMS, type SocialLinks, type SocialPlatform } from "@/lib/socialLinks";
import { uploadMediaObject } from "@/lib/r2";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  const profile = useMyProfile();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);
  const sheet = useSheet();
  // Home gym: null = none, {id,name} = chosen. Touched tracks whether the user
  // changed it so Save only writes home_gym_id when it actually moved.
  const [homeGym, setHomeGym] = useState<{ id: string; name: string } | null>(null);
  const [homeGymTouched, setHomeGymTouched] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.display_name ?? "");
      setUsername(profile.data.username ?? "");
      setBio(profile.data.bio ?? "");
      setAvatarUri(profile.data.avatar_url ?? null);
      setSocial(parseSocialLinks(profile.data.social_links));
      setHomeGym(profile.data.gym ? { id: profile.data.gym.id, name: profile.data.gym.name } : null);
      setHomeGymTouched(false);
    }
  }, [profile.data]);

  const openGymPicker = () => {
    sheet.open(
      <HomeGymSheet
        hasCurrent={Boolean(homeGym)}
        onSelect={(gym) => {
          setHomeGym(gym);
          setHomeGymTouched(true);
        }}
        onRemove={() => {
          setHomeGym(null);
          setHomeGymTouched(true);
        }}
        onClose={sheet.close}
      />
    );
  };

  const setSocialField = (key: SocialPlatform, value: string) => {
    setSocial((prev) => ({ ...prev, [key]: value }));
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });
    if (!result.canceled && result.assets[0]) {
      setNewAvatarLocal(result.assets[0].uri);
    }
  };

  const save = async () => {
    if (displayName.trim().length < 1) {
      appAlert("Name required", "Add a display name.");
      return;
    }
    const nextUsername = username.trim().toLowerCase();
    const usernameChanged = Boolean(profile.data?.username) && nextUsername !== profile.data?.username;
    if (usernameChanged && !/^[a-z0-9_]{3,20}$/.test(nextUsername)) {
      appAlert("Invalid username", "3–20 characters: lowercase letters, numbers, and underscores.");
      return;
    }
    if (!isSupabaseConfigured || !userId) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      let avatarPath: string | undefined;
      if (newAvatarLocal) {
        const compressed = await compressReactionSelfie(newAvatarLocal);
        const body = await (await fetch(compressed)).arrayBuffer();
        if (!body || body.byteLength === 0) {
          throw new Error("The selected image could not be read.");
        }
        // Each path is timestamped and unique, so a plain insert never
        // conflicts. (upsert trips the avatars bucket's RLS, which has no
        // WITH CHECK on updates — that was the silent "couldn't save" cause.)
        // 30s cap: the storage upload has no timeout of its own, so a dead
        // connection spun the Save button forever.
        avatarPath = await Promise.race([
          uploadMediaObject(`${userId}/avatar-${Date.now()}.jpg`, body, "image/jpeg"),
          new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("upload_timeout")), 30_000))
        ]);
      }
      // Keep only non-empty, trimmed handles.
      const cleanedSocial: SocialLinks = {};
      for (const platform of SOCIAL_PLATFORMS) {
        const value = social[platform.key]?.trim();
        if (value) {
          cleanedSocial[platform.key] = value.slice(0, 200);
        }
      }
      const update: {
        display_name: string;
        bio: string;
        avatar_url?: string;
        social_links: SocialLinks;
        username?: string;
        home_gym_id?: string | null;
      } = {
        display_name: displayName.trim().slice(0, 40),
        bio: bio.trim().slice(0, 200),
        social_links: cleanedSocial
      };
      if (usernameChanged) {
        update.username = nextUsername;
      }
      if (homeGymTouched) {
        update.home_gym_id = homeGym?.id ?? null;
      }
      if (avatarPath) {
        update.avatar_url = avatarPath;
      }
      const { error } = await supabase.from("profiles").update(update).eq("id", userId);
      if (error) {
        throw error;
      }
      // NOT awaited: invalidateQueries resolves only after every matching
      // active query refetches — one stalled refetch left the Save spinner
      // running forever. The row is saved; refresh in the background.
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("edit_profile_failed", { message });
      // Server-enforced username rules → specific dialogs.
      if (message.includes("username_cooldown")) {
        const changedAt = (profile.data as { username_changed_at?: string | null } | undefined)?.username_changed_at;
        const daysLeft = changedAt
          ? Math.max(1, Math.ceil((new Date(changedAt).getTime() + 30 * 86_400_000 - Date.now()) / 86_400_000))
          : null;
        appAlert(
          "Username on cooldown",
          daysLeft
            ? `You can change your username once every 30 days — try again in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`
            : "You can change your username once every 30 days."
        );
      } else if (message.includes("username_invalid")) {
        appAlert("Invalid username", "3–20 characters: lowercase letters, numbers, and underscores.");
      } else if (message.includes("duplicate") || message.includes("unique")) {
        appAlert("Username taken", "Someone already has that username — try another.");
      } else {
        appAlert("Couldn't save", "Something went wrong. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.black }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <PanelHeader title="Edit profile" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: keyboardVisible ? 12 : insets.bottom + 28 }}
      >
        <View style={{ alignItems: "center", paddingTop: 12 }}>
          <Pressable onPress={() => void pickAvatar()} accessibilityLabel="Change photo">
            <View>
              {newAvatarLocal ? (
                <Image source={{ uri: newAvatarLocal }} style={{ width: 92, height: 92, borderRadius: 46 }} contentFit="cover" />
              ) : (
                <Avatar name={displayName || "?"} uri={avatarUri} size={92} />
              )}
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
                <Camera size={15} color={colors.black} strokeWidth={2.2} />
              </View>
            </View>
          </Pressable>
          <Pressable onPress={() => void pickAvatar()} style={{ paddingTop: 8 }} haptic={false}>
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }}>Change photo</Text>
          </Pressable>
        </View>

        <SectionLabel>Name</SectionLabel>
        <View style={{ paddingHorizontal: 18 }}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            accessibilityLabel="Display name"
            placeholder="Display name"
            placeholderTextColor={colors.fog}
            maxLength={40}
            style={inputStyle}
          />
        </View>

        <SectionLabel>Bio</SectionLabel>
        <View style={{ paddingHorizontal: 18 }}>
          <TextInput
            value={bio}
            onChangeText={setBio}
            accessibilityLabel="Bio"
            placeholder="Add a bio"
            placeholderTextColor={colors.fog}
            multiline
            maxLength={200}
            textAlignVertical="top"
            style={[inputStyle, { minHeight: 80, paddingTop: 12 }]}
          />
          <Text style={{ alignSelf: "flex-end", paddingTop: 6, fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.fog }}>
            {bio.length}/200
          </Text>
        </View>

        <SectionLabel>Social links</SectionLabel>
        <View style={{ paddingHorizontal: 18, gap: 10 }}>
          {SOCIAL_PLATFORMS.map((platform) => (
            <View
              key={platform.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 46,
                borderWidth: 1,
                borderColor: colors.iron,
                borderRadius: 12,
                backgroundColor: colors.graphite,
                paddingHorizontal: 12
              }}
            >
              <platform.icon size={17} color={colors.silver} strokeWidth={2} />
              <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 12, color: colors.fog }}>{platform.prefix}</Text>
              <TextInput
                value={social[platform.key] ?? ""}
                onChangeText={(value) => setSocialField(platform.key, value)}
                accessibilityLabel={platform.label}
                placeholder={platform.placeholder}
                placeholderTextColor={colors.fog}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={platform.key === "website" ? "url" : "default"}
                maxLength={200}
                style={{ flex: 1, fontSize: 15, color: colors.white, paddingVertical: 12 }}
              />
            </View>
          ))}
        </View>

        <SectionLabel>Home gym</SectionLabel>
        <View style={{ paddingHorizontal: 18 }}>
          <Pressable accessibilityLabel="Edit home gym" onPress={openGymPicker} haptic={false}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 46,
                borderWidth: 1,
                borderColor: colors.iron,
                borderRadius: 12,
                backgroundColor: colors.graphite,
                paddingHorizontal: 14
              }}
            >
              <MapPin size={16} color={colors.silver} strokeWidth={2} />
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontSize: 15, color: homeGym ? colors.white : colors.fog }}
              >
                {homeGym ? homeGym.name : "Set your home gym"}
              </Text>
              <ChevronRight size={16} color={colors.fog} />
            </View>
          </Pressable>
        </View>

        <SectionLabel>Username</SectionLabel>
        <View style={{ paddingHorizontal: 18 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 46,
              borderWidth: 1,
              borderColor: colors.iron,
              borderRadius: 12,
              backgroundColor: colors.graphite,
              paddingHorizontal: 14
            }}
          >
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 13, color: colors.fog }}>@</Text>
            <TextInput
              value={username}
              onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              accessibilityLabel="Username"
              placeholder="username"
              placeholderTextColor={colors.fog}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={{ flex: 1, fontSize: 15, color: colors.white, paddingVertical: 12 }}
            />
          </View>
          <Text style={{ paddingTop: 6, fontSize: 11.5, lineHeight: 16, color: colors.fog }}>
            You can change your username once every 30 days.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 24 }}>
          <Button onPress={() => void save()} loading={saving} disabled={saving}>
            Save
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
