import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Crop, Download, Eraser, Pen, RotateCw, Trash2, Type, Undo2, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path as SvgPath } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

import { useKeyboardHeight } from "@/hooks/useKeyboardVisible";
import { savePhotoToCameraRoll } from "@/lib/mediaLibrary";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

type Tool = "none" | "draw" | "text" | "sticker" | "crop";

type Stroke = { id: string; d: string; color: string; width: number };
type TextItem = { id: string; text: string; color: string; font: string; x: number; y: number };
type StickerItem = { id: string; emoji: string; x: number; y: number };

const PEN_COLORS = ["#FAFAFA", "#000000", "#E8B44C", "#EF4444", "#3B82F6", "#22C55E", "#EC4899"];
// Text overlay fonts (#18) — all already loaded at app start.
const TEXT_FONTS: { label: string; family: string }[] = [
  { label: "Bold", family: "Geist_700Bold" },
  { label: "Display", family: "Boldonse_400Regular" },
  { label: "Mono", family: "GeistMono_500Medium" },
  { label: "Light", family: "Geist_400Regular" }
];
const PEN_WIDTHS = [4, 8, 14];

let counter = 0;
const uid = () => `e${++counter}`;

/** Full-saturation hue → hex (the RGB wheel slider). */
function hslToHex(hue: number): string {
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = 0.5 - Math.max(-1, Math.min(k - 3, 9 - k, 1)) * 0.45;
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function DraggableOverlay({
  x,
  y,
  onSelect,
  onTap,
  onDragEnd,
  onDragStateChange,
  trashHot,
  screenWidth,
  screenHeight,
  children
}: {
  x: number;
  y: number;
  onSelect: () => void;
  /** Fired on a clean tap (no drag) — used to re-open text for editing. */
  onTap?: () => void;
  /** Final translated position after a drag — used for the trash-zone drop test. */
  onDragEnd?: (finalX: number, finalY: number) => void;
  /** Fired when a drag starts/ends — the parent shows the trash can meanwhile. */
  onDragStateChange?: (active: boolean) => void;
  /** 1 while the dragged element hovers the trash zone (drives its grow effect). */
  trashHot?: SharedValue<number>;
  screenWidth?: number;
  screenHeight?: number;
  children: React.ReactNode;
}) {
  const tx = useSharedValue(x);
  const ty = useSharedValue(y);
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);
  const start = useSharedValue({ x, y });
  const baseScale = useSharedValue(1);
  const baseRot = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = { x: tx.value, y: ty.value };
      runOnJS(onSelect)();
    })
    .onStart(() => {
      if (onDragStateChange) runOnJS(onDragStateChange)(true);
    })
    .onUpdate((e) => {
      tx.value = start.value.x + e.translationX;
      ty.value = start.value.y + e.translationY;
      if (trashHot && screenWidth && screenHeight) {
        trashHot.value = ty.value > screenHeight - 200 && Math.abs(tx.value - screenWidth / 2) < 130 ? 1 : 0;
      }
    })
    .onEnd(() => {
      if (onDragEnd) runOnJS(onDragEnd)(tx.value, ty.value);
    })
    .onFinalize(() => {
      if (trashHot) trashHot.value = 0;
      if (onDragStateChange) runOnJS(onDragStateChange)(false);
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      baseScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.4, Math.min(5, baseScale.value * e.scale));
    });
  const rotate = Gesture.Rotation()
    .onBegin(() => {
      baseRot.value = rot.value;
    })
    .onUpdate((e) => {
      rot.value = baseRot.value + e.rotation;
    });
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(onSelect)();
      if (onTap) runOnJS(onTap)();
    });
  // Drag/pinch/rotate take priority; the tap only lands when nothing moved.
  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pan, pinch, rotate), tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotateZ: `${rot.value}rad` }
    ]
  }));

  return (
    <GestureDetector gesture={gesture}>
      {/* Generous padding = a bigger multi-touch target so pinch-to-resize and
          rotate register on small emoji/text. No visible background or border —
          the element sits clean on the photo like Instagram/Snapchat. */}
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, padding: 16 }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

/**
 * Snapchat/Instagram-style editor for stories, daily posts and non-daily
 * photos. Tools stack in one session: filters, pen drawing,
 * draggable/resizable text + emoji stickers, rotate. "Done" flattens the
 * layers to a new image via view-shot (falls back to the original if capture
 * isn't available).
 */
export function PhotoEditor({
  uri,
  insetUri,
  bakeInset = true,
  onDone,
  onCancel
}: {
  uri: string;
  /** Optional dual-camera selfie shown as the corner PIP. */
  insetUri?: string | null;
  /**
   * Whether the inset is FLATTENED into the exported image.
   *
   * Stories bake it (true): a story is one flat image — there is no separate
   * inset column to draw from later.
   *
   * Daily posts must NOT bake it (false): they upload the selfie separately as
   * `inset_url`, and the feed, profile grid and streak calendar all draw the
   * PIP live from that column. Baking it here too would show the same selfie
   * TWICE on the post. Rendering it outside the captured view still lets you
   * see and compose around the PIP while editing, while `inset_url` stays the
   * single source of truth.
   */
  bakeInset?: boolean;
  onDone: (editedUri: string, overlayText: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const captureViewRef = useRef<View>(null);

  const [tool, setTool] = useState<Tool>("none");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [textFont, setTextFont] = useState(TEXT_FONTS[0].family);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  // Base image (crop/rotate now happen as a live transform, baked on export).
  const [workingUri] = useState(uri);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  /** Non-null while re-editing an existing text element. */
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  /** True while an element is being dragged — the trash can shows meanwhile. */
  const [dragging, setDragging] = useState(false);
  const trashHot = useSharedValue(0);
  const trashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + trashHot.value * 0.35 }]
  }));

  // Crop transform (2b) — pinch/zoom/rotate/pan the base photo inside the fixed
  // full-screen frame. Persisted so the flattened export bakes exactly what's
  // visible; snapshotted on entry so Cancel restores.
  const cScale = useSharedValue(1);
  const cTx = useSharedValue(0);
  const cTy = useSharedValue(0);
  const cRot = useSharedValue(0);
  const cScaleStart = useSharedValue(1);
  const cTxStart = useSharedValue(0);
  const cTyStart = useSharedValue(0);
  const cRotStart = useSharedValue(0);
  const cropSnapshot = useRef({ scale: 1, tx: 0, ty: 0, rot: 0 });

  const cropStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cTx.value },
      { translateY: cTy.value },
      { scale: cScale.value },
      { rotateZ: `${cRot.value}rad` }
    ]
  }));

  const cropPan = Gesture.Pan()
    .onStart(() => {
      cTxStart.value = cTx.value;
      cTyStart.value = cTy.value;
    })
    .onUpdate((e) => {
      cTx.value = cTxStart.value + e.translationX;
      cTy.value = cTyStart.value + e.translationY;
    });
  const cropPinch = Gesture.Pinch()
    .onStart(() => {
      cScaleStart.value = cScale.value;
    })
    .onUpdate((e) => {
      // Clamp min to fill-frame so there are no black edges unless intentional.
      cScale.value = Math.max(1, cScaleStart.value * e.scale);
    });
  const cropRotate = Gesture.Rotation()
    .onStart(() => {
      cRotStart.value = cRot.value;
    })
    .onUpdate((e) => {
      cRot.value = cRotStart.value + e.rotation;
    });
  const cropGesture = Gesture.Simultaneous(cropPan, cropPinch, cropRotate);

  // Chronological undo log — strokes, texts, AND crops undo in the order
  // they happened (the old undo was strokes-then-stickers-then-texts).
  const actionsRef = useRef<("stroke" | "text" | "crop")[]>([]);
  const cropUndoRef = useRef<{ scale: number; tx: number; ty: number; rot: number }[]>([]);

  const enterCrop = () => {
    cropSnapshot.current = { scale: cScale.value, tx: cTx.value, ty: cTy.value, rot: cRot.value };
    setTool("crop");
  };
  const cancelCrop = () => {
    const s = cropSnapshot.current;
    cScale.value = withTiming(s.scale, { duration: 140 });
    cTx.value = withTiming(s.tx, { duration: 140 });
    cTy.value = withTiming(s.ty, { duration: 140 });
    cRot.value = withTiming(s.rot, { duration: 140 });
    setTool("none");
  };
  const rotate90 = () => {
    cRot.value = withTiming(cRot.value + Math.PI / 2, { duration: 160 });
  };
  /**
   * Snap the crop transform back inside "covers the frame" bounds — panning
   * or rotating could expose the black backdrop at the edges, which then got
   * BAKED into the exported image (the reported "weird borders").
   */
  const clampCrop = () => {
    const r = cRot.value;
    const c = Math.abs(Math.cos(r));
    const s = Math.abs(Math.sin(r));
    const minScale = Math.max((width * c + height * s) / width, (width * s + height * c) / height, 1);
    const scale = Math.max(cScale.value, minScale);
    const slackX = Math.max(0, (scale * (width * c + height * s) - width) / 2);
    const slackY = Math.max(0, (scale * (width * s + height * c) - height) / 2);
    cScale.value = withTiming(scale, { duration: 160 });
    cTx.value = withTiming(Math.max(-slackX, Math.min(slackX, cTx.value)), { duration: 160 });
    cTy.value = withTiming(Math.max(-slackY, Math.min(slackY, cTy.value)), { duration: 160 });
  };
  const applyCrop = () => {
    cropUndoRef.current.push({ ...cropSnapshot.current });
    actionsRef.current.push("crop");
    clampCrop();
    setTool("none");
  };

  const ptsRef = useRef<string>("");

  // RGB wheel (8th swatch): opens a full-hue slider at the bottom.
  const [showWheel, setShowWheel] = useState(false);
  const [hueBarWidth, setHueBarWidth] = useState(0);
  const pickHue = (x: number) => {
    if (hueBarWidth <= 0) return;
    const hue = Math.max(0, Math.min(359, (x / hueBarWidth) * 360));
    setPenColor(hslToHex(hue));
  };
  const hueGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => pickHue(e.x))
    .onUpdate((e) => pickHue(e.x));

  // Eraser: a true brush — it carves away only the PARTS of strokes it drags
  // over (splitting a line into surviving segments), not whole lines.
  const [erasing, setErasing] = useState(false);
  const eraseAt = (x: number, y: number) => {
    const R2 = 22 * 22;
    setStrokes((prev) => {
      const out: Stroke[] = [];
      let changed = false;
      for (const stroke of prev) {
        const nums = stroke.d.match(/-?\d+(\.\d+)?/g);
        if (!nums) {
          out.push(stroke);
          continue;
        }
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])]);
        const segs: [number, number][][] = [];
        let seg: [number, number][] = [];
        let hit = false;
        for (const p of pts) {
          const dx = p[0] - x;
          const dy = p[1] - y;
          if (dx * dx + dy * dy <= R2) {
            hit = true;
            if (seg.length > 1) segs.push(seg);
            seg = [];
          } else {
            seg.push(p);
          }
        }
        if (seg.length > 1) segs.push(seg);
        if (!hit) {
          out.push(stroke);
          continue;
        }
        changed = true;
        for (const sPts of segs) {
          out.push({
            id: uid(),
            d:
              `M ${sPts[0][0]} ${sPts[0][1]}` +
              sPts
                .slice(1)
                .map((p) => ` L ${p[0]} ${p[1]}`)
                .join(""),
            color: stroke.color,
            width: stroke.width
          });
        }
      }
      return changed ? out : prev;
    });
  };

  // runOnJS(true): callbacks run on the JS thread, so touching the React ref
  // and calling setState directly is safe. The worklet version crashed in Expo
  // Go — refs are host objects the UI thread can't touch, and passing updater
  // closures through runOnJS() isn't serializable.
  const drawGesture = Gesture.Pan()
    .enabled(tool === "draw")
    .runOnJS(true)
    .onBegin((e) => {
      if (erasing) {
        eraseAt(e.x, e.y);
        return;
      }
      ptsRef.current = `M ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
    })
    .onUpdate((e) => {
      if (erasing) {
        eraseAt(e.x, e.y);
        return;
      }
      ptsRef.current += ` L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
      setStrokes((prev) => {
        const next = prev.slice();
        const live = { id: "live", d: ptsRef.current, color: penColor, width: penWidth };
        if (next.length && next[next.length - 1].id === "live") next[next.length - 1] = live;
        else next.push(live);
        return next;
      });
    })
    .onFinalize(() => {
      if (erasing) return;
      actionsRef.current.push("stroke");
      setStrokes((prev) => prev.map((s) => (s.id === "live" ? { ...s, id: uid() } : s)));
    });

  const addText = () => {
    const text = draft.trim();
    setComposing(false);
    setDraft("");
    if (editingTextId) {
      // Re-edit: save the new content/color/font, or delete if cleared.
      setTexts((prev) =>
        text
          ? prev.map((t) => (t.id === editingTextId ? { ...t, text, color: penColor, font: textFont } : t))
          : prev.filter((t) => t.id !== editingTextId)
      );
      setEditingTextId(null);
      setTool("none");
      return;
    }
    if (!text) {
      // Dismissed empty: the tool must reset too — leaving it on "text" left
      // the editor stuck (rail lit, tap-to-type dead).
      setTool("none");
      return;
    }
    actionsRef.current.push("text");
    setTexts((prev) => [
      ...prev,
      { id: uid(), text, color: penColor, font: textFont, x: width / 2 - 60, y: height / 2 - 20 }
    ]);
    setTool("none");
  };

  /** Cancel the text composer entirely (rail Type button acts as a toggle). */
  const cancelCompose = () => {
    setComposing(false);
    setDraft("");
    setEditingTextId(null);
    setTool("none");
  };

  const removeElement = (id: string) => {
    setTexts((prev) => prev.filter((t) => t.id !== id));
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setSelected(null);
  };

  /** Dropping an element on the trash zone (bottom center) deletes it. */
  const handleDrop = (id: string) => (finalX: number, finalY: number) => {
    if (finalY > height - 200 && Math.abs(finalX - width / 2) < 130) {
      removeElement(id);
    }
  };

  const editText = (item: TextItem) => {
    setEditingTextId(item.id);
    setDraft(item.text);
    setPenColor(item.color);
    setTextFont(item.font);
    setComposing(true);
  };

  const undo = () => {
    // Chronological: the LAST thing done is what undoes — including crops.
    const last = actionsRef.current.pop();
    if (last === "stroke") {
      setStrokes((prev) => prev.slice(0, -1));
    } else if (last === "text") {
      setTexts((prev) => prev.slice(0, -1));
    } else if (last === "crop") {
      const snap = cropUndoRef.current.pop();
      if (snap) {
        cScale.value = withTiming(snap.scale, { duration: 160 });
        cTx.value = withTiming(snap.tx, { duration: 160 });
        cTy.value = withTiming(snap.ty, { duration: 160 });
        cRot.value = withTiming(snap.rot, { duration: 160 });
      }
    } else if (stickers.length) {
      // Legacy stickers from before the emoji tool was removed.
      setStickers((prev) => prev.slice(0, -1));
    }
  };

  /**
   * True when nothing has actually been changed — no drawing, no text, no
   * legacy sticker, an untouched crop transform, and no selfie inset that has
   * to be flattened in.
   */
  const hasNoEdits = (): boolean =>
    strokes.length === 0 &&
    texts.length === 0 &&
    stickers.length === 0 &&
    cScale.value === 1 &&
    cTx.value === 0 &&
    cTy.value === 0 &&
    cRot.value === 0 &&
    !(insetUri && bakeInset);

  const renderEditedPhoto = async (): Promise<string> => {
    setSelected(null);
    // captureRef rasterises the VIEW, so it caps the photo at the on-screen
    // size — roughly 1170px wide at @3x, less at @2x — and re-encodes it. That
    // is a large, permanent quality loss, and it was being paid on every trip
    // through the editor even when the user changed nothing. Opening the editor
    // and pressing Done should be lossless.
    if (hasNoEdits()) return workingUri;
    let out = workingUri;
    try {
      // Race against a timeout so a platform without capture support can never hang Done.
      const captured = await Promise.race([
        // quality 1: this is already downsampled to screen size, so the JPEG
        // step should not take a second bite. lib/posts re-encodes on upload.
        captureRef(captureViewRef, { format: "jpg", quality: 1 }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
      ]);
      if (captured) out = captured;
    } catch {
      // No native capture available — post the original photo rather than fail.
    }
    return out;
  };

  const saveToLibrary = async () => {
    if (savingToLibrary) return;
    setSavingToLibrary(true);
    try {
      const out = await renderEditedPhoto();
      const result = await savePhotoToCameraRoll(out);
      if (result === "saved") {
        trackAnalyticsEvent("photo_saved", { mode: "story", dual: Boolean(insetUri) });
        showToast("Saved to camera roll");
      } else if (result === "denied") showToast("Allow photo access in Settings to save");
      else showToast("Saving photos isn't available on this device");
    } catch {
      showToast("Couldn't save photo");
    } finally {
      setSavingToLibrary(false);
    }
  };

  const done = async () => {
    setSaving(true);
    const out = await renderEditedPhoto();
    setSaving(false);
    // Hand the raw overlay text back so it can be scanned for slurs server-side
    // (it's baked into the image otherwise, unreadable to text moderation).
    onDone(
      out,
      texts
        .map((t) => t.text)
        .join(" ")
        .trim()
    );
  };

  // One definition, rendered either inside the captured frame (stories, where
  // it must be flattened into the image) or outside it (daily posts, where the
  // selfie is uploaded separately as inset_url and drawn live by the feed).
  const insetPip = insetUri ? (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top + 66,
        left: 16,
        width: "30%",
        aspectRatio: 3 / 4,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: colors.black,
        backgroundColor: colors.black
      }}
    >
      <Image source={{ uri: insetUri }} contentFit="cover" style={{ flex: 1 }} />
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Captured region: photo (crop-transformed) + drawings + overlays. The
          frame clips the base image so the transform IS the crop when flattened. */}
      <View ref={captureViewRef} collapsable={false} style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
        <Animated.View style={[StyleSheet.absoluteFill, cropStyle]}>
          <Image source={{ uri: workingUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {strokes.map((s) => (
            <SvgPath
              key={s.id}
              d={s.d}
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>

        {/* Tap the photo to start typing (overlays render above and keep
            their own gestures; draw mode's surface covers this). */}
        {tool === "none" && !composing ? (
          <Pressable
            accessibilityLabel="Tap to add text"
            onPress={() => {
              setTool("text");
              setComposing(true);
            }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Baked only for stories. For a daily post this same PIP is rendered
            OUTSIDE the captured view below, so it never lands in the pixels. */}
        {insetUri && bakeInset ? insetPip : null}

        {texts.map((t) => (
          <DraggableOverlay
            key={t.id}
            x={t.x}
            y={t.y}
            onSelect={() => setSelected(t.id)}
            onTap={() => editText(t)}
            onDragEnd={handleDrop(t.id)}
            onDragStateChange={setDragging}
            trashHot={trashHot}
            screenWidth={width}
            screenHeight={height}
          >
            <Text
              style={{
                fontFamily: t.font,
                fontSize: 30,
                color: t.color,
                textShadowColor: "rgba(0,0,0,0.5)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
                paddingHorizontal: 4
              }}
            >
              {t.text}
            </Text>
          </DraggableOverlay>
        ))}
        {stickers.map((s) => (
          <DraggableOverlay
            key={s.id}
            x={s.x}
            y={s.y}
            onSelect={() => setSelected(s.id)}
            onDragEnd={handleDrop(s.id)}
            onDragStateChange={setDragging}
            trashHot={trashHot}
            screenWidth={width}
            screenHeight={height}
          >
            <Text style={{ fontSize: 52 }}>{s.emoji}</Text>
          </DraggableOverlay>
        ))}
      </View>

      {/* Daily posts: the PIP lives OUTSIDE the captured frame, so you can see
          and compose around it while editing but it is never flattened into the
          exported photo — the post stores the selfie once, in inset_url, and
          the feed draws it from there. */}
      {insetUri && !bakeInset ? insetPip : null}

      {/* Draw gesture surface (only intercepts touches in draw mode) */}
      {tool === "draw" ? (
        <GestureDetector gesture={drawGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      ) : null}

      {/* Top bar: cancel / done */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 14,
          right: 14,
          flexDirection: "row",
          justifyContent: "space-between"
        }}
      >
        <RoundBtn onPress={onCancel} accessibilityLabel="Cancel">
          <X size={22} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <Pressable onPress={() => void done()} disabled={saving} accessibilityLabel="Done">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 40,
              paddingHorizontal: 18,
              borderRadius: 20,
              backgroundColor: colors.white
            }}
          >
            <Check size={17} color={colors.black} strokeWidth={2.6} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>
              {saving ? "Saving…" : "Done"}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Right-side tool rail. Draw mode collapses the rail to just the pen
          with the color column beneath it (other tools return on exit). Every
          tool button toggles OFF when tapped again. */}
      <View style={{ position: "absolute", top: insets.top + 64, right: 12, gap: 12, alignItems: "center" }}>
        {tool !== "draw" ? (
          <RoundBtn
            active={tool === "text" || composing}
            onPress={() => {
              if (composing || tool === "text") {
                cancelCompose();
              } else {
                setTool("text");
                setComposing(true);
              }
            }}
            accessibilityLabel="Text"
          >
            <Type size={20} color={colors.white} strokeWidth={2.2} />
          </RoundBtn>
        ) : null}
        <RoundBtn
          active={tool === "draw"}
          onPress={() => {
            setShowWheel(false);
            setErasing(false);
            setTool(tool === "draw" ? "none" : "draw");
          }}
          accessibilityLabel="Draw"
        >
          <Pen size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        {tool === "draw" ? (
          <>
            {/* Colors drop vertically under the pen: 7 defaults + the wheel. */}
            {PEN_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setPenColor(c);
                  setErasing(false);
                  setShowWheel(false);
                }}
                accessibilityLabel={`Color ${c}`}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: c,
                    borderWidth: !erasing && !showWheel && penColor === c ? 3 : 1,
                    borderColor: !erasing && !showWheel && penColor === c ? colors.white : "rgba(255,255,255,0.5)"
                  }}
                />
              </Pressable>
            ))}
            {/* 8th: the RGB wheel — opens the hue bar at the bottom. */}
            <Pressable
              onPress={() => {
                setShowWheel((v) => !v);
                setErasing(false);
              }}
              accessibilityLabel="Color wheel"
              accessibilityState={{ selected: showWheel }}
            >
              <LinearGradient
                colors={["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  borderWidth: showWheel ? 3 : 1,
                  borderColor: showWheel ? colors.white : "rgba(255,255,255,0.5)"
                }}
              />
            </Pressable>
            {/* Eraser — carves strokes where you drag. */}
            <Pressable
              onPress={() => {
                setErasing((v) => !v);
                setShowWheel(false);
              }}
              accessibilityLabel="Eraser"
              accessibilityState={{ selected: erasing }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.45)",
                  borderWidth: erasing ? 3 : 1,
                  borderColor: erasing ? colors.white : "rgba(255,255,255,0.5)"
                }}
              >
                <Eraser size={14} color={colors.white} strokeWidth={2.2} />
              </View>
            </Pressable>
          </>
        ) : (
          <>
            <RoundBtn
              active={tool === "crop"}
              onPress={() => (tool === "crop" ? cancelCrop() : enterCrop())}
              accessibilityLabel="Crop"
            >
              <Crop size={20} color={colors.white} strokeWidth={2.2} />
            </RoundBtn>
            <RoundBtn onPress={undo} accessibilityLabel="Undo">
              <Undo2 size={20} color={colors.white} strokeWidth={2.2} />
            </RoundBtn>
          </>
        )}
      </View>

      {/* Save the current flattened edit without leaving the story editor. */}
      {tool === "none" && !dragging && !composing ? (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 14 }}>
          <RoundBtn onPress={() => void saveToLibrary()} accessibilityLabel="Save photo to camera roll">
            {savingToLibrary ? (
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 11, color: colors.white }}>•••</Text>
            ) : (
              <Download size={20} color={colors.white} strokeWidth={2.2} />
            )}
          </RoundBtn>
        </View>
      ) : null}

      {/* Draw mode bottom controls: stroke widths + (when the wheel swatch is
          on) the full-hue slider. Colors themselves live in the rail column. */}
      {tool === "draw" ? (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 14, right: 70, gap: 10 }}>
          {showWheel ? (
            <GestureDetector gesture={hueGesture}>
              <View
                onLayout={(e) => setHueBarWidth(e.nativeEvent.layout.width)}
                accessibilityRole="adjustable"
                accessibilityLabel="Pick any color"
              >
                <LinearGradient
                  colors={["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#FF0000"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ height: 26, borderRadius: 13, borderWidth: 2, borderColor: penColor }}
                />
              </View>
            </GestureDetector>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            {PEN_WIDTHS.map((w) => (
              <Pressable key={w} onPress={() => setPenWidth(w)} accessibilityLabel={`Width ${w}`}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: penWidth === w ? 2 : 1,
                    borderColor: penWidth === w ? colors.white : "rgba(255,255,255,0.4)"
                  }}
                >
                  <View
                    style={{ width: w + 2, height: w + 2, borderRadius: (w + 2) / 2, backgroundColor: colors.white }}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Text composer — tapping anywhere outside the field commits and exits
          (no need to find the button), and a Done chip sits at the top where the
          keyboard can't cover it. */}
      {composing ? (
        <Pressable
          onPress={addText}
          accessibilityLabel="Done editing text"
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]}
        >
          <View style={{ position: "absolute", top: insets.top + 10, right: 14 }}>
            <View
              style={{
                height: 40,
                paddingHorizontal: 20,
                borderRadius: 20,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Done</Text>
            </View>
          </View>
          {/* Input centers in the VISIBLE area (screen minus keyboard) —
              middle of the screen per partner ask, never hidden under keys. */}
          <View
            style={{
              position: "absolute",
              top: insets.top + 60,
              left: 24,
              right: 24,
              bottom: keyboardHeight,
              justifyContent: "center"
            }}
            pointerEvents="box-none"
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type…"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoFocus
              multiline
              // Return commits the text directly (no edit-options detour).
              submitBehavior="blurAndSubmit"
              returnKeyType="done"
              onSubmitEditing={addText}
              style={{ minWidth: 200, fontFamily: textFont, fontSize: 30, color: penColor, textAlign: "center" }}
            />
            {/* Font picker (#18) — IDENTICAL bubble size for every font;
                colors come from the pen palette below. */}
            <View style={{ marginTop: 18, flexDirection: "row", justifyContent: "center", gap: 8 }}>
              {TEXT_FONTS.map((f) => {
                const on = textFont === f.family;
                return (
                  <Pressable
                    key={f.family}
                    onPress={() => setTextFont(f.family)}
                    accessibilityLabel={`Font ${f.label}`}
                  >
                    <View
                      style={{
                        width: 72,
                        height: 34,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 999,
                        backgroundColor: on ? colors.white : "rgba(0,0,0,0.4)",
                        borderWidth: 1,
                        borderColor: on ? colors.white : "rgba(255,255,255,0.35)"
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: f.family, fontSize: 13, color: on ? colors.black : colors.white }}
                      >
                        {f.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "center", gap: 10 }}>
              {PEN_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setPenColor(c)} accessibilityLabel={`Color ${c}`}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: c,
                      borderWidth: penColor === c ? 3 : 1,
                      borderColor: penColor === c ? colors.white : "rgba(255,255,255,0.5)"
                    }}
                  />
                </Pressable>
              ))}
            </View>
            <Text
              style={{
                marginTop: 14,
                textAlign: "center",
                fontFamily: "GeistMono_400Regular",
                fontSize: 10,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.6)"
              }}
            >
              TAP ANYWHERE TO FINISH
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Hint */}
      {selected && Platform.OS !== "web" ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: insets.top + 60, left: 0, right: 0, alignItems: "center" }}
        >
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: "rgba(255,255,255,0.7)" }}>
            DRAG · PINCH · TWIST · TAP TEXT TO EDIT · DRAG TO TRASH TO DELETE
          </Text>
        </View>
      ) : null}

      {/* Snapchat-style trash: appears only while dragging an element, grows
          when the element hovers it, and dropping there deletes. */}
      {dragging ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", bottom: insets.bottom + 74, left: 0, right: 0, alignItems: "center" }}
        >
          <Animated.View
            style={[
              {
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.9)",
                backgroundColor: "rgba(0,0,0,0.55)",
                alignItems: "center",
                justifyContent: "center"
              },
              trashStyle
            ]}
          >
            <Trash2 size={24} color={colors.white} strokeWidth={2} />
          </Animated.View>
        </View>
      ) : null}

      {/* Crop mode (2b): pinch/zoom/rotate/pan the photo inside the frame. The
          full-screen gesture layer sits above the media but below the controls. */}
      {tool === "crop" ? (
        <>
          <GestureDetector gesture={cropGesture}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>
          {/* Frame guides */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }]}
          />
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + 20,
              left: 0,
              right: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24
            }}
          >
            <Pressable onPress={cancelCrop} accessibilityLabel="Cancel crop" hitSlop={10}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={22} color={colors.white} strokeWidth={2.2} />
              </View>
            </Pressable>
            <Pressable onPress={rotate90} accessibilityLabel="Rotate 90 degrees" hitSlop={10}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <RotateCw size={22} color={colors.white} strokeWidth={2.2} />
              </View>
            </Pressable>
            <Pressable onPress={applyCrop} accessibilityLabel="Apply crop" hitSlop={10}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: colors.white,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Check size={22} color={colors.black} strokeWidth={2.6} />
              </View>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

function RoundBtn({
  children,
  onPress,
  active,
  accessibilityLabel
}: {
  children: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} hitSlop={6}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.4)",
          borderWidth: active ? 1.5 : 0,
          borderColor: colors.white
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}
