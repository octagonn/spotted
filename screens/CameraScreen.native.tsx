import { useQueryClient } from "@tanstack/react-query";

import { invalidateAfterPostChange } from "@/lib/queryClient";
import { appAlert } from "@/components/ui/AppDialog";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ImageIcon, Music2, RefreshCcw, Send, X, Zap } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, type PhotoFile } from "react-native-vision-camera";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useSpottedCamera } from "@/lib/camera";
import { impactHaptic, successHaptic } from "@/lib/haptics";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useCameraStore } from "@/stores/camera";
import { colors } from "@/theme/colors";

type StagedPhoto =
  | { kind: "captured"; uri: string; mime: string }
  | { kind: "library"; uri: string; mime: string };

function GlassPill({
  children,
  onPress,
  size = 44
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
}) {
  return (
    <Pressable
      className="overflow-hidden rounded-full border border-hairline-strong"
      onPress={onPress}
      pressedClassName="opacity-80"
      style={{ width: size, height: size } as never}
    >
      <BlurView intensity={36} tint="dark" className="absolute inset-0" />
      <View className="flex-1 items-center justify-center bg-glass-soft">{children}</View>
    </Pressable>
  );
}

async function uploadPhotoToSupabase(uri: string, mime: string, userId: string): Promise<string> {
  const fileUri = uri.startsWith("file://") || uri.startsWith("ph://") || uri.startsWith("assets-library://") ? uri : `file://${uri}`;
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("posts")
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
      upsert: false
    });
  if (error) throw error;
  return path;
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();
  const captureSignal = useCameraStore((state) => state.captureSignal);
  const [position, setPosition] = useState<"front" | "back">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [photo, setPhoto] = useState<StagedPhoto | null>(null);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const camera = useSpottedCamera(position);
  const lastSignalRef = useRef(captureSignal);

  async function capture() {
    if (!camera.ready || !cameraRef.current) {
      appAlert("Camera not ready", "Grant camera permission and wait for the lens to warm up.");
      return;
    }
    try {
      await impactHaptic();
      const result: PhotoFile = await cameraRef.current.takePhoto({ flash });
      setPhoto({ kind: "captured", uri: `file://${result.path}`, mime: "image/jpeg" });
      await successHaptic();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera failed.";
      appAlert("Couldn't capture", message);
    }
  }

  useEffect(() => {
    if (captureSignal !== lastSignalRef.current) {
      lastSignalRef.current = captureSignal;
      if (!photo) {
        void capture();
      }
    }
  }, [captureSignal, photo]);

  async function pickFromLibrary() {
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
    } catch {
      appAlert(
        "Library not available",
        "Photo library isn't bundled in this build of the dev client. Install the latest build to enable it."
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        appAlert("Library access off", "Enable photo access in Settings to pick a post from your library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        exif: false
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setPhoto({
        kind: "library",
        uri: asset.uri,
        mime: asset.mimeType ?? "image/jpeg"
      });
      await successHaptic();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't open library.";
      appAlert("Library error", message);
    }
  }

  async function postDrop() {
    if (!photo) return;
    if (!isSupabaseConfigured || !userId) {
      appAlert("Not signed in", "Sign in to post.");
      return;
    }
    setPosting(true);
    try {
      const path = await uploadPhotoToSupabase(photo.uri, photo.mime, userId);
      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        media_url: path,
        media_type: "image",
        caption: caption.trim() || null,
        is_verified_at_gym: photo.kind === "captured"
      });
      if (error) throw error;
      await invalidateAfterPostChange(queryClient);
      await successHaptic();
      setPhoto(null);
      setCaption("");
      router.replace("/feed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      appAlert("Couldn't post", message);
    } finally {
      setPosting(false);
    }
  }

  if (!camera.cameraPermission.hasPermission) {
    return (
      <View className="flex-1 justify-end bg-black p-6 pb-32">
        <Text variant="display-md">CHECK IN</Text>
        <Text variant="italic" className="mt-5">
          Permission first. Posts after.
        </Text>
        <Button
          className="mt-8"
          onPress={async () => {
            await camera.cameraPermission.requestPermission();
          }}
        >
          Enable camera
        </Button>
        <Pressable
          className="mt-4 self-center"
          onPress={pickFromLibrary}
          haptic={false}
        >
          <Text variant="micro" className="text-mist">
            OR PICK FROM LIBRARY
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!camera.device) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color={colors.white} />
        <Text variant="micro" className="mt-4 text-mist">
          STARTING CAMERA…
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {photo ? (
        <Image source={{ uri: photo.uri }} contentFit="cover" style={{ flex: 1 }} />
      ) : (
        <Camera
          ref={cameraRef}
          device={camera.device}
          isActive={!photo}
          photo
          style={{ flex: 1 }}
        />
      )}

      {!photo ? (
        <View
          className="absolute left-0 right-0 flex-row items-center justify-between px-5"
          style={{ top: insets.top + 8 }}
        >
          <GlassPill onPress={() => setFlash(flash === "off" ? "on" : "off")}>
            <Zap
              color={flash === "on" ? colors.white : colors.mist}
              size={20}
              strokeWidth={1.8}
              fill={flash === "on" ? colors.white : "transparent"}
            />
          </GlassPill>
          <View className="overflow-hidden rounded-pill border border-hairline-strong">
            <BlurView intensity={36} tint="dark" className="absolute inset-0" />
            <View className="bg-glass-soft px-4 py-2">
              <Text variant="micro" className="text-mist">
                CHECK IN · TODAY'S POST
              </Text>
            </View>
          </View>
          <GlassPill onPress={() => setPosition(position === "back" ? "front" : "back")}>
            <RefreshCcw color={colors.white} size={20} strokeWidth={1.8} />
          </GlassPill>
        </View>
      ) : null}

      <View className="absolute left-0 right-0" style={{ bottom: insets.bottom + 110 }}>
        {photo ? (
          <View className="mx-5 mb-6 overflow-hidden rounded-card border border-hairline-strong">
            <BlurView intensity={42} tint="dark" className="absolute inset-0" />
            <View className="bg-glass-soft p-4">
              <Text variant="micro" className="text-mist">
                {photo.kind === "captured" ? "READY TO POST · VERIFIED AT GYM" : "READY TO POST · FROM LIBRARY"}
              </Text>
              <TextInput
                className="mt-4 min-h-12 rounded-spotted border border-hairline-strong bg-glass-soft px-4 py-3 font-sans text-[16px] text-white"
                placeholder="Caption the damage"
                placeholderTextColor={colors.fog}
                value={caption}
                onChangeText={setCaption}
                maxLength={200}
              />
              <View className="mt-3 flex-row items-center gap-2 rounded-spotted border border-hairline-strong bg-glass-soft px-4 py-3">
                <Music2 color={colors.mist} size={16} />
                <Text variant="caption" className="flex-1 text-mist">
                  Add song
                </Text>
                <Text variant="micro" className="text-fog">
                  COMING SOON
                </Text>
              </View>
              <View className="mt-4 flex-row items-center gap-3">
                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full border border-hairline-strong bg-glass-soft"
                  onPress={() => {
                    setPhoto(null);
                    setCaption("");
                  }}
                  accessibilityLabel="Discard"
                >
                  <X color={colors.mist} size={20} strokeWidth={1.8} />
                </Pressable>
                <View className="flex-1">
                  <Button
                    icon={<Send color={colors.black} size={17} />}
                    onPress={postDrop}
                    loading={posting}
                  >
                    Post 24h lift
                  </Button>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-around px-8">
            <Pressable
              className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-hairline-strong"
              onPress={pickFromLibrary}
              accessibilityLabel="Pick from library"
            >
              <BlurView intensity={36} tint="dark" className="absolute inset-0" />
              <View className="absolute inset-0 bg-glass-soft" />
              <ImageIcon color={colors.white} size={20} strokeWidth={1.8} />
            </Pressable>

            <Pressable
              className="h-[80px] w-[80px] items-center justify-center"
              pressedClassName="scale-95"
              onPress={capture}
              testID="camera-shutter"
              accessibilityRole="button"
              accessibilityLabel="Capture lift"
              haptic={false}
            >
              <View className="h-[80px] w-[80px] rounded-full border-[3px] border-white" />
              <View className="absolute h-[62px] w-[62px] rounded-full bg-white/95" />
            </Pressable>

            <View style={{ width: 48, height: 48 }} />
          </View>
        )}
      </View>
    </View>
  );
}
