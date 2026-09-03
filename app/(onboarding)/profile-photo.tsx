import { router } from "expo-router";
import { appAlert } from "@/components/ui/AppDialog";
import * as ImagePicker from "expo-image-picker";
import { Camera, Images } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { usePageFade } from "@/hooks/usePageFade";
import { compressReactionSelfie } from "@/lib/posts";
import { uploadMediaObject } from "@/lib/r2";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon, tokens } from "@/theme/tokens";

/**
 * Dedicated profile-photo step — prominent (a whole step, giant avatar) but
 * skippable: profiles with faces get added back far more, but nobody gets
 * walled. Skipping keeps the initials avatar; Edit Profile can add one later.
 */
export default function OnboardingProfilePhotoScreen() {
  const insets = useSafeAreaInsets();
  const { fadeStyle, fadeNavigate } = usePageFade();
  const userId = useAuthStore((state) => state.userId);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      appAlert("Camera access needed", "Enable camera access in Settings to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const next = () => fadeNavigate(() => router.push("/permissions"));

  async function saveAndContinue() {
    if (!photoUri) {
      next();
      return;
    }
    if (!isSupabaseConfigured || !userId) {
      next();
      return;
    }
    setSubmitting(true);
    try {
      const compressed = await compressReactionSelfie(photoUri);
      const body = await (await fetch(compressed)).arrayBuffer();
      if (body.byteLength > 0) {
        const avatarUrl = await uploadMediaObject(`${userId}/avatar-${Date.now()}.jpg`, body, "image/jpeg");
        await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      }
      next();
    } catch {
      // The photo is a bonus, never a wall — move on and let Edit Profile retry.
      next();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1 }, fadeStyle]}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24
        }}
      >
        <OnboardingHeader
          step={4}
          title="PUT A FACE ON IT."
          body="Profiles with photos get added back way more. Optional — but worth it."
        />

        {/* The photo is the hero of this screen. */}
        <View className="mt-10 items-center">
          <Pressable
            onPress={() => void pickFromLibrary()}
            accessibilityLabel={photoUri ? "Change profile photo" : "Add a profile photo"}
          >
            <View
              style={{
                borderRadius: 999,
                borderWidth: 3,
                borderColor: photoUri ? tokens.accent.gold : colors.hairlineStrong,
                padding: 5
              }}
            >
              <Avatar size={168} rounded="circle" uri={photoUri} name="?" />
            </View>
          </Pressable>
        </View>

        <View className="mt-10 gap-3">
          <Button icon={<Camera size={icon.size.xs + 1} color={colors.black} />} onPress={() => void takePhoto()}>
            Take a photo
          </Button>
          <Button
            variant="ghost"
            icon={<Images size={icon.size.xs + 1} color={colors.white} />}
            onPress={() => void pickFromLibrary()}
          >
            Choose from library
          </Button>
        </View>

        <View className="flex-1" />
        {photoUri ? (
          <Button className="mt-8" onPress={() => void saveAndContinue()} loading={submitting}>
            Looking good — continue
          </Button>
        ) : (
          <Pressable onPress={next} accessibilityLabel="Skip adding a photo" className="mt-8 items-center py-3">
            <Text variant="body-strong" className="text-mist">
              Skip for now
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );
}
