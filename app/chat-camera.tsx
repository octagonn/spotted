import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from "expo-camera";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Flame, RefreshCcw, Send, X, Zap, ZapOff } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { useInboxThreadActions } from "@/components/friends/useInboxThreads";
import { useSendMediaMessage } from "@/hooks/queries/useMessages";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * In-message camera (WS7): Snapchat-style capture for DMs. Front/rear toggle,
 * flash toggle, tap-to-capture, then a preview with Send / Retake. Photos
 * captured HERE send as view-once; camera-roll picks in the composer stay
 * permanent — the distinction is capture source.
 */
export default function ChatCameraScreen() {
  const { conversation } = useLocalSearchParams<{ conversation?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [shot, setShot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const sendMedia = useSendMediaMessage(conversation ?? null);
  const inboxActions = useInboxThreadActions();

  const capture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) setShot(photo.uri);
    } catch {
      showToast("Couldn't take the photo — try again");
    } finally {
      setCapturing(false);
    }
  };

  const send = () => {
    if (!shot || !conversation || sendMedia.isPending) return;
    sendMedia.mutate(
      { localUri: shot, kind: "image", viewOnce: true },
      {
        onSuccess: () => {
          inboxActions.invalidate();
          router.back();
        },
        onError: () => showToast("Couldn't send the photo — try again")
      }
    );
  };

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center", paddingHorizontal: 44 }}>
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white, textAlign: "center" }}>
          Camera access needed
        </Text>
        <Text style={{ marginTop: 10, fontSize: 13, lineHeight: 19, color: colors.fog, textAlign: "center" }}>
          Photos you take here send as view-once — they disappear after your friend opens them.
        </Text>
        <Pressable
          onPress={() => void requestPermission()}
          accessibilityLabel="Allow camera access"
          style={{ marginTop: 20, backgroundColor: colors.white, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 26 }}
        >
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityLabel="Cancel" style={{ marginTop: 14, padding: 8 }}>
          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.silver }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Preview: Send / Retake ----
  if (shot) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <Image source={{ uri: shot }} contentFit="contain" style={{ flex: 1 }} />
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: insets.top + 14, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 13, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: tokens.accent.gold }}
        >
          <Flame size={13} color={tokens.accent.gold} strokeWidth={2.2} />
          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: tokens.accent.gold }}>View once</Text>
        </View>
        <View style={{ position: "absolute", bottom: insets.bottom + 24, left: 24, right: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => setShot(null)}
            disabled={sendMedia.isPending}
            accessibilityLabel="Retake photo"
            style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 999, paddingVertical: 13, paddingHorizontal: 22 }}
          >
            <RefreshCcw size={16} color={colors.white} strokeWidth={2.2} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>Retake</Text>
          </Pressable>
          <Pressable
            onPress={send}
            disabled={sendMedia.isPending}
            accessibilityLabel="Send view-once photo"
            style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: colors.white, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26 }}
          >
            {sendMedia.isPending ? (
              <ActivityIndicator color={colors.black} />
            ) : (
              <>
                <Send size={16} color={colors.black} strokeWidth={2.2} />
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Send</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Live camera ----
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} flash={flash} />
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Close camera"
        hitSlop={10}
        style={{ position: "absolute", top: insets.top + 12, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
      >
        <X size={20} color={colors.white} strokeWidth={2.2} />
      </Pressable>
      <View style={{ position: "absolute", top: insets.top + 12, right: 18, gap: 12 }}>
        <Pressable
          onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          accessibilityLabel="Flip camera"
          hitSlop={8}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
        >
          <RefreshCcw size={19} color={colors.white} strokeWidth={2.1} />
        </Pressable>
        <Pressable
          onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
          accessibilityLabel={flash === "off" ? "Turn flash on" : "Turn flash off"}
          hitSlop={8}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}
        >
          {flash === "off" ? (
            <ZapOff size={19} color={colors.white} strokeWidth={2.1} />
          ) : (
            <Zap size={19} color={tokens.accent.gold} strokeWidth={2.1} />
          )}
        </Pressable>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", bottom: insets.bottom + 118, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Flame size={12} color={tokens.accent.gold} strokeWidth={2.2} />
        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>
          Sends as view-once
        </Text>
      </View>
      <Pressable
        onPress={() => void capture()}
        disabled={capturing}
        accessibilityLabel="Take photo"
        style={{ position: "absolute", bottom: insets.bottom + 30, alignSelf: "center", width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: "center", justifyContent: "center" }}
      >
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: capturing ? colors.slate : colors.white }} />
      </Pressable>
    </View>
  );
}
