import { Image as ExpoImage } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import { Check, RotateCcw, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image as RNImage, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { logger } from "@/lib/logger";
import { colors } from "@/theme/colors";

const MIN = 56; // smallest crop box in screen px
const HANDLE = 30; // touch target for corner handles

/**
 * Manual, freeform crop. The image is shown contain-fitted so the whole frame
 * is visible; a crop rectangle with four corner handles can be dragged and
 * resized anywhere, then applied to the actual pixels. No presets, no automatic
 * crop — the user is fully in control.
 */
export function FreeformCrop({
  uri,
  onApply,
  onCancel
}: {
  uri: string;
  onApply: (croppedUri: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null); // container size
  const [img, setImg] = useState<{ w: number; h: number } | null>(null); // source pixels
  const [imgRect, setImgRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [applying, setApplying] = useState(false);

  // Crop edges in screen coords (shared values → smooth UI-thread dragging).
  const l = useSharedValue(0);
  const t = useSharedValue(0);
  const r = useSharedValue(0);
  const b = useSharedValue(0);
  // Live image bounds for clamping inside worklets.
  const irx = useSharedValue(0);
  const iry = useSharedValue(0);
  const irr = useSharedValue(0);
  const irb = useSharedValue(0);

  // Read the source dimensions once.
  useEffect(() => {
    let cancelled = false;
    RNImage.getSize(
      uri,
      (w, h) => {
        if (!cancelled) setImg({ w, h });
      },
      () => {
        // Fallback: manipulate with no ops just to read the size.
        ImageManipulator.manipulateAsync(uri, [], { compress: 1 })
          .then((res) => {
            if (!cancelled) setImg({ w: res.width, h: res.height });
          })
          .catch(() => {});
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  // Once we know both the container and the image, compute the contain-fit rect
  // and initialize the crop box to the full image.
  useEffect(() => {
    if (!box || !img) return;
    const scale = Math.min(box.w / img.w, box.h / img.h);
    const w = img.w * scale;
    const h = img.h * scale;
    const x = (box.w - w) / 2;
    const y = (box.h - h) / 2;
    setImgRect({ x, y, w, h });
    l.value = x;
    t.value = y;
    r.value = x + w;
    b.value = y + h;
    irx.value = x;
    iry.value = y;
    irr.value = x + w;
    irb.value = y + h;
  }, [box, img, l, t, r, b, irx, iry, irr, irb]);

  const reset = () => {
    if (!imgRect) return;
    l.value = imgRect.x;
    t.value = imgRect.y;
    r.value = imgRect.x + imgRect.w;
    b.value = imgRect.y + imgRect.h;
  };

  // Move the whole box, clamped to the image bounds.
  const bl = useSharedValue(0);
  const bt = useSharedValue(0);
  const bodyPan = Gesture.Pan()
    .onBegin(() => {
      bl.value = l.value;
      bt.value = t.value;
    })
    .onUpdate((e) => {
      const w = r.value - l.value;
      const h = b.value - t.value;
      let nl = bl.value + e.translationX;
      let nt = bt.value + e.translationY;
      nl = Math.max(irx.value, Math.min(irr.value - w, nl));
      nt = Math.max(iry.value, Math.min(irb.value - h, nt));
      l.value = nl;
      t.value = nt;
      r.value = nl + w;
      b.value = nt + h;
    });

  // Corner resize. Only one corner drags at a time, so a single snapshot pair
  // is shared across the four gestures (keeps hooks at the top level).
  const snapH = useSharedValue(0);
  const snapV = useSharedValue(0);
  const cornerGesture = (horiz: "l" | "r", vert: "t" | "b") =>
    Gesture.Pan()
      .onBegin(() => {
        snapH.value = horiz === "l" ? l.value : r.value;
        snapV.value = vert === "t" ? t.value : b.value;
      })
      .onUpdate((e) => {
        if (horiz === "l") {
          l.value = Math.max(irx.value, Math.min(r.value - MIN, snapH.value + e.translationX));
        } else {
          r.value = Math.min(irr.value, Math.max(l.value + MIN, snapH.value + e.translationX));
        }
        if (vert === "t") {
          t.value = Math.max(iry.value, Math.min(b.value - MIN, snapV.value + e.translationY));
        } else {
          b.value = Math.min(irb.value, Math.max(t.value + MIN, snapV.value + e.translationY));
        }
      });
  const tlPan = cornerGesture("l", "t");
  const trPan = cornerGesture("r", "t");
  const blPan = cornerGesture("l", "b");
  const brPan = cornerGesture("r", "b");

  // Animated styles.
  const boxStyle = useAnimatedStyle(() => ({
    left: l.value,
    top: t.value,
    width: r.value - l.value,
    height: b.value - t.value
  }));
  const dimTop = useAnimatedStyle(() => ({ height: t.value }));
  const dimBottom = useAnimatedStyle(() => ({ top: b.value }));
  const dimLeft = useAnimatedStyle(() => ({ top: t.value, height: b.value - t.value, width: l.value }));
  const dimRight = useAnimatedStyle(() => ({ top: t.value, height: b.value - t.value, left: r.value }));
  const cornerTL = useAnimatedStyle(() => ({ left: l.value - HANDLE / 2, top: t.value - HANDLE / 2 }));
  const cornerTR = useAnimatedStyle(() => ({ left: r.value - HANDLE / 2, top: t.value - HANDLE / 2 }));
  const cornerBL = useAnimatedStyle(() => ({ left: l.value - HANDLE / 2, top: b.value - HANDLE / 2 }));
  const cornerBR = useAnimatedStyle(() => ({ left: r.value - HANDLE / 2, top: b.value - HANDLE / 2 }));
  // Rule-of-thirds guide lines.
  const third1V = useAnimatedStyle(() => ({ left: l.value + (r.value - l.value) / 3, top: t.value, height: b.value - t.value }));
  const third2V = useAnimatedStyle(() => ({ left: l.value + ((r.value - l.value) * 2) / 3, top: t.value, height: b.value - t.value }));
  const third1H = useAnimatedStyle(() => ({ top: t.value + (b.value - t.value) / 3, left: l.value, width: r.value - l.value }));
  const third2H = useAnimatedStyle(() => ({ top: t.value + ((b.value - t.value) * 2) / 3, left: l.value, width: r.value - l.value }));

  const apply = async () => {
    if (!imgRect || !img || applying) {
      onCancel();
      return;
    }
    setApplying(true);
    try {
      // Map the on-screen crop box back into source pixels.
      const scaleX = img.w / imgRect.w;
      const scaleY = img.h / imgRect.h;
      const originX = Math.max(0, Math.round((l.value - imgRect.x) * scaleX));
      const originY = Math.max(0, Math.round((t.value - imgRect.y) * scaleY));
      const width = Math.min(img.w - originX, Math.round((r.value - l.value) * scaleX));
      const height = Math.min(img.h - originY, Math.round((b.value - t.value) * scaleY));
      if (width < 8 || height < 8) {
        onCancel();
        return;
      }
      const out = await ImageManipulator.manipulateAsync(uri, [{ crop: { originX, originY, width, height } }], {
        compress: 0.98,
        format: ImageManipulator.SaveFormat.JPEG
      });
      onApply(out.uri);
    } catch (error) {
      logger.warn("freeform_crop_failed", { message: error instanceof Error ? error.message : String(error) });
      onCancel();
    } finally {
      setApplying(false);
    }
  };

  const ready = Boolean(imgRect);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Crop stage */}
      <View
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ position: "absolute", top: insets.top + 60, left: 0, right: 0, bottom: insets.bottom + 92 }}
      >
        {imgRect ? (
          <ExpoImage
            source={{ uri }}
            contentFit="fill"
            style={{ position: "absolute", left: imgRect.x, top: imgRect.y, width: imgRect.w, height: imgRect.h }}
          />
        ) : null}

        {ready ? (
          <>
            {/* Dim outside the crop */}
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, backgroundColor: "rgba(0,0,0,0.55)" }, dimTop]} />
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }, dimBottom]} />
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, backgroundColor: "rgba(0,0,0,0.55)" }, dimLeft]} />
            <Animated.View pointerEvents="none" style={[{ position: "absolute", right: 0, backgroundColor: "rgba(0,0,0,0.55)" }, dimRight]} />

            {/* Crop body (drag to move) */}
            <GestureDetector gesture={bodyPan}>
              <Animated.View style={[{ position: "absolute", borderWidth: 1.5, borderColor: colors.white }, boxStyle]} />
            </GestureDetector>

            {/* Thirds guides */}
            <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 1, backgroundColor: "rgba(255,255,255,0.35)" }, third1V]} />
            <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 1, backgroundColor: "rgba(255,255,255,0.35)" }, third2V]} />
            <Animated.View pointerEvents="none" style={[{ position: "absolute", height: 1, backgroundColor: "rgba(255,255,255,0.35)" }, third1H]} />
            <Animated.View pointerEvents="none" style={[{ position: "absolute", height: 1, backgroundColor: "rgba(255,255,255,0.35)" }, third2H]} />

            {/* Corner handles */}
            <CornerHandle gesture={tlPan} style={cornerTL} />
            <CornerHandle gesture={trPan} style={cornerTR} />
            <CornerHandle gesture={blPan} style={cornerBL} />
            <CornerHandle gesture={brPan} style={cornerBR} />
          </>
        ) : null}
      </View>

      {/* Top bar */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <RoundBtn onPress={onCancel} label="Cancel crop">
          <X size={22} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white }}>Crop</Text>
        <RoundBtn onPress={reset} label="Reset crop">
          <RotateCcw size={19} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
      </View>

      {/* Apply */}
      <View style={{ position: "absolute", bottom: insets.bottom + 22, left: 18, right: 18, alignItems: "center" }}>
        <Pressable onPress={() => void apply()} disabled={applying || !ready} accessibilityLabel="Apply crop">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 50, paddingHorizontal: 30, borderRadius: 25, backgroundColor: colors.white }}>
            <Check size={18} color={colors.black} strokeWidth={2.6} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.black }}>{applying ? "Cropping…" : "Apply crop"}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function CornerHandle({ gesture, style }: { gesture: ReturnType<typeof Gesture.Pan>; style: object }) {
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ position: "absolute", width: HANDLE, height: HANDLE, alignItems: "center", justifyContent: "center" }, style]}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.black }} />
      </Animated.View>
    </GestureDetector>
  );
}

function RoundBtn({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" }}>
        {children}
      </View>
    </Pressable>
  );
}
