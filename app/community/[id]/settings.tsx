import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Globe, Lock, Pencil } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { useCommunity, useUpdateCommunity } from "@/hooks/queries/useCommunities";
import { compressReactionSelfie } from "@/lib/posts";
import { logger } from "@/lib/logger";
import { publicAvatarUrl, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

const NAME_MAX = 126;
const DESC_MAX = 1251;

export default function CommunitySettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const community = useCommunity(id);
  const update = useUpdateCommunity(id);

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
      const path = `${userId}/community-${Date.now()}.jpg`;
      const upload = await supabase.storage.from("avatars").upload(path, body, { contentType: "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;
      setPhotoUrl(publicAvatarUrl(path) ?? null);
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

  if (community.isLoading || !hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!community.data?.isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Settings" />
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          Only the community admin can edit these.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Community settings" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 28 }}>
        <View style={{ alignItems: "center", paddingTop: 8 }}>
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
        <TextInput value={name} onChangeText={(v) => setName(v.slice(0, NAME_MAX))} maxLength={NAME_MAX} placeholder="Community name" placeholderTextColor={colors.fog} style={inputStyle} />
        <Counter value={name.length} max={NAME_MAX} />

        <Label>Description</Label>
        <TextInput value={description} onChangeText={(v) => setDescription(v.slice(0, DESC_MAX))} maxLength={DESC_MAX} multiline textAlignVertical="top" placeholder="What's this community about?" placeholderTextColor={colors.fog} style={[inputStyle, { minHeight: 92, paddingTop: 12 }]} />
        <Counter value={description.length} max={DESC_MAX} />

        <Label>Privacy</Label>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PrivacyPill active={privacy === "public"} onPress={() => setPrivacy("public")} icon={<Globe size={14} color={privacy === "public" ? colors.black : colors.silver} strokeWidth={2} />} label="Public" />
          <PrivacyPill active={privacy === "private"} onPress={() => setPrivacy("private")} icon={<Lock size={14} color={privacy === "private" ? colors.black : colors.silver} strokeWidth={2} />} label="Private" />
        </View>

        <Label>Location</Label>
        <TextInput value={location} onChangeText={setLocation} placeholder="City, State — leave blank for global" placeholderTextColor={colors.fog} style={inputStyle} />

        <View style={{ paddingTop: 24 }}>
          <Button loading={update.isPending} disabled={update.isPending} onPress={save}>
            Save changes
          </Button>
        </View>
      </ScrollView>
    </View>
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
    <Pressable onPress={onPress} style={{ flex: 1 }}>
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
