import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { compressReactionSelfie } from "@/lib/posts";
import { logger } from "@/lib/logger";
import { parseSocialLinks, SOCIAL_PLATFORMS, type SocialLinks, type SocialPlatform } from "@/lib/socialLinks";
import { isSupabaseConfigured, publicAvatarUrl, supabase } from "@/lib/supabase";
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
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.display_name ?? "");
      setBio(profile.data.bio ?? "");
      setAvatarUri(profile.data.avatar_url ?? null);
      setSocial(parseSocialLinks(profile.data.social_links));
    }
  }, [profile.data]);

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
      Alert.alert("Name required", "Add a display name.");
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
        const path = `${userId}/${Date.now()}.jpg`;
        const upload = await supabase.storage.from("avatars").upload(path, body, {
          contentType: "image/jpeg",
          upsert: false
        });
        if (upload.error) {
          throw upload.error;
        }
        avatarPath = path;
      }
      // Keep only non-empty, trimmed handles.
      const cleanedSocial: SocialLinks = {};
      for (const platform of SOCIAL_PLATFORMS) {
        const value = social[platform.key]?.trim();
        if (value) {
          cleanedSocial[platform.key] = value.slice(0, 200);
        }
      }
      const update: { display_name: string; bio: string; avatar_url?: string; social_links: SocialLinks } = {
        display_name: displayName.trim().slice(0, 40),
        bio: bio.trim().slice(0, 200),
        social_links: cleanedSocial
      };
      if (avatarPath) {
        update.avatar_url = publicAvatarUrl(avatarPath) ?? avatarPath;
      }
      const { error } = await supabase.from("profiles").update(update).eq("id", userId);
      if (error) {
        throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.back();
    } catch (error) {
      logger.warn("edit_profile_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      Alert.alert("Couldn't save", "Something went wrong. Try again.");
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

        {profile.data?.username ? (
          <>
            <SectionLabel>Username</SectionLabel>
            <Text style={{ paddingHorizontal: 18, fontSize: 14, color: colors.silver }}>@{profile.data.username}</Text>
          </>
        ) : null}

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
