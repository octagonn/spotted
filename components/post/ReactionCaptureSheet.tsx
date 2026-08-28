import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { SwitchCamera } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";

import { SheetSub, SheetTitle } from "@/components/ui/Sheet";
import { Pressable } from "@/components/ui/Pressable";
import { useAddReactionSelfie } from "@/hooks/queries/usePostReactionSelfies";
import { showToast, triggerFlash, useUiStore } from "@/stores/ui";
import { cameraSurfaceProps } from "@/components/camera/CameraKit";
import { colors } from "@/theme/colors";

const VIEWPORT = 190;

/** Animated scan line: white 12% band sweeping vertically, 2.2s linear ∞. */
function ScanLine() {
  const reduced = useReducedMotion();
  const y = useSharedValue(-0.6);
  useEffect(() => {
    if (!reduced) {
      y.value = withRepeat(withTiming(0.6, { duration: 2200, easing: Easing.linear }), -1, false);
    }
    return () => cancelAnimation(y);
  }, [reduced, y]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value * VIEWPORT }]
  }));
  if (reduced) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: VIEWPORT * 0.12,
          backgroundColor: "rgba(255,255,255,0.12)"
        },
        style
      ]}
    />
  );
}

/** Reaction capture sheet (§4.7) — one quick shot, front OR back camera. */
export function ReactionCaptureSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const markReacted = useUiStore((state) => state.markReacted);
  const addReaction = useAddReactionSelfie();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  // Partner ask: reactions were selfie-only — allow flipping to the rear cam.
  const [facing, setFacing] = useState<"front" | "back">("front");
  const canUseCamera = Platform.OS !== "web" && permission?.granted;

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const capture = async () => {
    if (capturing) return;
    setCapturing(true);
    let uri: string | null = null;
    if (canUseCamera) {
      try {
        uri = (await cameraRef.current?.takePictureAsync({ quality: 0.5 }))?.uri ?? null;
        // Flip back to mirror-image so the selfie matches the preview —
        // front camera only; a rear shot must stay unmirrored.
        if (uri && facing === "front") {
          const flipped = await ImageManipulator.manipulateAsync(
            uri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = flipped.uri;
        }
      } catch {
        uri = null;
      }
    }
    triggerFlash();
    markReacted(postId, uri);
    // Persist so friends see it (best-effort — local state already updated).
    addReaction.mutate({ postId, selfieUri: uri });
    showToast("Live reaction added");
    setTimeout(onClose, 160);
  };

  return (
    <View style={{ alignItems: "center", paddingBottom: 8 }}>
      <SheetTitle center>Live reaction</SheetTitle>
      <SheetSub center>One quick shot</SheetSub>
      <View
        style={{
          width: VIEWPORT,
          height: VIEWPORT,
          borderRadius: VIEWPORT / 2,
          borderWidth: 2,
          borderColor: colors.slate,
          overflow: "hidden",
          marginTop: 14,
          backgroundColor: colors.charcoal
        }}
      >
        {canUseCamera ? <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={facing}
            // Selfie cam with no flash control — the default shutter
            // animation blinked the screen white, which read as a flash.
            {...cameraSurfaceProps({ flashOn: false, facing })}
          /> : <View style={{ flex: 1, backgroundColor: colors.charcoal }} />}
        <ScanLine />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 22, marginTop: 18 }}>
        {/* Symmetric spacer keeps the shutter centered under the viewport. */}
        <View style={{ width: 44, height: 44 }} />
        <Pressable
          onPress={() => void capture()}
          accessibilityLabel="Capture reaction"
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 4,
            borderColor: colors.white,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white }} />
        </Pressable>
        <Pressable
          onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
          accessibilityLabel={facing === "front" ? "Switch to back camera" : "Switch to front camera"}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.slate,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <SwitchCamera size={19} color={colors.white} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}
