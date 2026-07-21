import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { AtSign, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { compressReactionSelfie } from "@/lib/posts";
import { isSupabaseConfigured, publicAvatarUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const usernameRegex = /^[a-z0-9_]+$/;

export default function OnboardingCreateProfileScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const session = useAuthStore((state) => state.session);
  const markProfileCreated = useAuthStore((state) => state.markProfileCreated);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameValid = username.length >= 3 && username.length <= 20 && usernameRegex.test(username);
  const displayNameValid = displayName.trim().length >= 1 && displayName.trim().length <= 40;
  const ready = usernameValid && displayNameValid && !submitting;

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Enable camera access in Settings to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const pickAvatar = () => {
    Alert.alert("Add a photo", undefined, [
      { text: "Take Photo", onPress: () => void takePhoto() },
      { text: "Choose from Library", onPress: () => void pickFromLibrary() },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  async function handleNext() {
    if (!ready) return;
    if (!isSupabaseConfigured || !userId) {
      router.push("/permissions");
      return;
    }
    setSubmitting(true);
    try {
      // Upload the chosen photo first (non-fatal — the profile is still created
      // if the upload fails; they can add one later from Edit Profile).
      let avatarUrl: string | undefined;
      if (avatarUri) {
        try {
          const compressed = await compressReactionSelfie(avatarUri);
          const body = await (await fetch(compressed)).arrayBuffer();
          if (body.byteLength > 0) {
            const path = `${userId}/${Date.now()}.jpg`;
            const upload = await supabase.storage.from("avatars").upload(path, body, {
              contentType: "image/jpeg",
              upsert: false
            });
            if (!upload.error) avatarUrl = publicAvatarUrl(path) ?? path;
          }
        } catch {
          // keep going without a photo
        }
      }
      const metadataBirthDate = session?.user.user_metadata?.birth_date;
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        username: username.toLowerCase(),
        display_name: displayName.trim(),
        birth_date: typeof metadataBirthDate === "string" ? metadataBirthDate : null,
        onboarding_stage: "permissions",
        ...(avatarUrl ? { avatar_url: avatarUrl } : {})
      });
      if (error) {
        throw error;
      }
      markProfileCreated(userId);
      router.push("/permissions");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save profile.";
      Alert.alert("Couldn't save profile", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.black }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24
        }}
      >
        <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
          <Text variant="micro" className="text-mist">
            STEP 3 OF 5
          </Text>
        </View>
        <Text variant="display-md" className="mt-6">
          MAKE A FACE.
        </Text>
        <Text variant="italic" className="mt-3">
          Add a photo, pick a name.
        </Text>

        <View className="mt-8 flex-row items-center gap-4 rounded-card border border-hairline-strong bg-glass-strong p-4">
          <Pressable onPress={pickAvatar} accessibilityLabel="Add a profile photo">
            <Avatar size={72} rounded="circle" uri={avatarUri} name={displayName || "?"} />
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: radius.pill,
                backgroundColor: tokens.accent.gold,
                borderWidth: 2,
                borderColor: colors.black,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Plus size={15} color={colors.black} strokeWidth={3} />
            </View>
          </Pressable>
          <View className="flex-1 gap-3">
            <View className="rounded-pill border border-hairline bg-glass-soft px-4 py-2">
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor={colors.fog}
                autoCapitalize="words"
                maxLength={40}
                returnKeyType="next"
                className="font-sansMedium text-[16px] text-white"
              />
            </View>
            <View className="flex-row items-center gap-2 rounded-pill border border-hairline bg-glass-soft px-4 py-2">
              <AtSign color={colors.mist} size={15} strokeWidth={2} />
              <TextInput
                value={username}
                onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="username"
                placeholderTextColor={colors.fog}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                className="flex-1 p-0 font-sans text-[14px] text-white"
              />
            </View>
          </View>
        </View>
        {!usernameValid && username.length > 0 ? (
          <Text variant="micro" className="mt-3 text-mist">
            3–20 chars, lowercase letters, numbers, underscore.
          </Text>
        ) : null}

        <View className="flex-1" />
        <Button className="mt-8" onPress={handleNext} loading={submitting} disabled={!ready}>
          Next
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
