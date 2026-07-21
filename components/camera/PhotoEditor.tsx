import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import { Check, Crop, Pen, RotateCw, Smile, Trash2, Type, Undo2, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path as SvgPath } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

import { FreeformCrop } from "@/components/camera/FreeformCrop";
import { colors } from "@/theme/colors";

type Tool = "none" | "draw" | "text" | "sticker" | "filter" | "crop";

type Stroke = { id: string; d: string; color: string; width: number };
type TextItem = { id: string; text: string; color: string; x: number; y: number };
type StickerItem = { id: string; emoji: string; x: number; y: number };

/** Stylistic overlay "looks". True per-pixel color grading needs a shader; these
 * are cross-platform tints that flatten reliably into the exported image.
 * Exported: the story review screen cycles these on horizontal swipes. */
export const FILTERS: { key: string; label: string; overlay: string | null }[] = [
  { key: "none", label: "Original", overlay: null },
  { key: "warm", label: "Warm", overlay: "rgba(255,150,40,0.18)" },
  { key: "cool", label: "Cool", overlay: "rgba(40,120,255,0.18)" },
  { key: "fade", label: "Fade", overlay: "rgba(240,240,255,0.16)" },
  { key: "noir", label: "Noir", overlay: "rgba(0,0,0,0.32)" },
  { key: "dusk", label: "Dusk", overlay: "rgba(120,40,120,0.20)" }
];

const PEN_COLORS = ["#FAFAFA", "#000000", "#E8B44C", "#EF4444", "#3B82F6", "#22C55E", "#EC4899"];
const PEN_WIDTHS = [4, 8, 14];
const EMOJIS = ["🔥", "💪", "🏋️", "😤", "🥵", "🎯", "🏆", "⚡", "💯", "🙌", "😮‍💨", "🧠"];

let counter = 0;
const uid = () => `e${++counter}`;

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
        trashHot.value =
          ty.value > screenHeight - 200 && Math.abs(tx.value - screenWidth / 2) < 130 ? 1 : 0;
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
  const tap = Gesture.Tap().maxDistance(10).onEnd(() => {
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
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, padding: 16 }, style]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Snapchat/Instagram-style editor for stories and non-daily photos. The daily
 * geoverified post never uses this — it stays raw. Tools stack in one session:
 * filters, pen drawing, draggable/resizable text + emoji stickers, rotate.
 * "Done" flattens the layers to a new image via view-shot (falls back to the
 * original if capture isn't available).
 */
export function PhotoEditor({
  uri,
  onDone,
  onCancel
}: {
  uri: string;
  onDone: (editedUri: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const captureViewRef = useRef<View>(null);

  const [tool, setTool] = useState<Tool>("none");
  const [filter, setFilter] = useState<string>("none");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  // Rotate/crop write real pixels via expo-image-manipulator; the edited base
  // image lives in workingUri (uri stays untouched for "Original" crop reset).
  const [workingUri, setWorkingUri] = useState(uri);
  const [transforming, setTransforming] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  /** Non-null while re-editing an existing text element. */
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** True while an element is being dragged — the trash can shows meanwhile. */
  const [dragging, setDragging] = useState(false);
  const trashHot = useSharedValue(0);
  const trashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + trashHot.value * 0.35 }]
  }));

  const ptsRef = useRef<string>("");

  const overlayColor = FILTERS.find((f) => f.key === filter)?.overlay ?? null;

  // runOnJS(true): callbacks run on the JS thread, so touching the React ref
  // and calling setState directly is safe. The worklet version crashed in Expo
  // Go — refs are host objects the UI thread can't touch, and passing updater
  // closures through runOnJS() isn't serializable.
  const drawGesture = Gesture.Pan()
    .enabled(tool === "draw")
    .runOnJS(true)
    .onBegin((e) => {
      ptsRef.current = `M ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
    })
    .onUpdate((e) => {
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
      setStrokes((prev) => prev.map((s) => (s.id === "live" ? { ...s, id: uid() } : s)));
    });

  /** Rotate the actual pixels 90° clockwise. Never throws out of the editor. */
  const rotate = async () => {
    if (transforming) return;
    setTransforming(true);
    try {
      const result = await ImageManipulator.manipulateAsync(workingUri, [{ rotate: 90 }], {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG
      });
      setWorkingUri(result.uri);
    } catch {
      // Leave the image as-is rather than crash or lose edits.
    } finally {
      setTransforming(false);
    }
  };

  const addText = () => {
    const text = draft.trim();
    setComposing(false);
    setDraft("");
    if (editingTextId) {
      // Re-edit: save the new content/color, or delete if cleared.
      setTexts((prev) =>
        text
          ? prev.map((t) => (t.id === editingTextId ? { ...t, text, color: penColor } : t))
          : prev.filter((t) => t.id !== editingTextId)
      );
      setEditingTextId(null);
      setTool("none");
      return;
    }
    if (!text) return;
    setTexts((prev) => [...prev, { id: uid(), text, color: penColor, x: width / 2 - 60, y: height / 2 - 20 }]);
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
    setComposing(true);
  };

  const addSticker = (emoji: string) => {
    setStickers((prev) => [...prev, { id: uid(), emoji, x: width / 2 - 24, y: height / 2 - 24 }]);
  };

  const undo = () => {
    if (strokes.length) setStrokes((prev) => prev.slice(0, -1));
    else if (stickers.length) setStickers((prev) => prev.slice(0, -1));
    else if (texts.length) setTexts((prev) => prev.slice(0, -1));
  };

  const done = async () => {
    setSelected(null);
    setSaving(true);
    let out = workingUri;
    try {
      // Race against a timeout so a platform without capture support can never hang Done.
      const captured = await Promise.race([
        captureRef(captureViewRef, { format: "jpg", quality: 0.9 }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
      ]);
      if (captured) out = captured;
    } catch {
      // No native capture available — post the original photo rather than fail.
    }
    setSaving(false);
    onDone(out);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* Captured region: photo + filter + drawings + overlays */}
      <View ref={captureViewRef} collapsable={false} style={StyleSheet.absoluteFill}>
        <Image source={{ uri: workingUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
        {overlayColor ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} pointerEvents="none" />
        ) : null}

        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {strokes.map((s) => (
            <SvgPath key={s.id} d={s.d} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>

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
                fontFamily: "Geist_700Bold",
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

      {/* Draw gesture surface (only intercepts touches in draw mode) */}
      {tool === "draw" ? (
        <GestureDetector gesture={drawGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      ) : null}

      {/* Top bar: cancel / done */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between" }}>
        <RoundBtn onPress={onCancel} accessibilityLabel="Cancel">
          <X size={22} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <Pressable onPress={() => void done()} disabled={saving} accessibilityLabel="Done">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.white }}>
            <Check size={17} color={colors.black} strokeWidth={2.6} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>{saving ? "Saving…" : "Done"}</Text>
          </View>
        </Pressable>
      </View>

      {/* Right-side tool rail */}
      <View style={{ position: "absolute", top: insets.top + 64, right: 12, gap: 12 }}>
        <RoundBtn active={tool === "text"} onPress={() => { setTool("text"); setComposing(true); }} accessibilityLabel="Text">
          <Type size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn active={tool === "draw"} onPress={() => setTool(tool === "draw" ? "none" : "draw")} accessibilityLabel="Draw">
          <Pen size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn active={tool === "sticker"} onPress={() => setTool(tool === "sticker" ? "none" : "sticker")} accessibilityLabel="Stickers">
          <Smile size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn active={tool === "filter"} onPress={() => setTool(tool === "filter" ? "none" : "filter")} accessibilityLabel="Filters">
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white }}>F</Text>
        </RoundBtn>
        <RoundBtn active={tool === "crop"} onPress={() => setTool(tool === "crop" ? "none" : "crop")} accessibilityLabel="Crop">
          <Crop size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn onPress={() => void rotate()} accessibilityLabel="Rotate">
          <RotateCw size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
        <RoundBtn onPress={undo} accessibilityLabel="Undo">
          <Undo2 size={20} color={colors.white} strokeWidth={2.2} />
        </RoundBtn>
      </View>

      {/* Pen color + width (draw or text tool) */}
      {tool === "draw" || tool === "text" ? (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 14, right: 70, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {PEN_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setPenColor(c)} accessibilityLabel={`Color ${c}`}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: penColor === c ? 3 : 1, borderColor: penColor === c ? colors.white : "rgba(255,255,255,0.5)" }} />
              </Pressable>
            ))}
          </View>
          {tool === "draw" ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              {PEN_WIDTHS.map((w) => (
                <Pressable key={w} onPress={() => setPenWidth(w)} accessibilityLabel={`Width ${w}`}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: penWidth === w ? 2 : 1, borderColor: penWidth === w ? colors.white : "rgba(255,255,255,0.4)" }}>
                    <View style={{ width: w + 2, height: w + 2, borderRadius: (w + 2) / 2, backgroundColor: colors.white }} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Busy overlay while rotating/cropping */}
      {transforming ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9, color: colors.white }}>…</Text>
          </View>
        </View>
      ) : null}

      {/* Filters row */}
      {tool === "filter" ? (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 0, right: 60 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}>
            {FILTERS.map((f) => (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityLabel={f.label}>
                <View style={{ width: 58, height: 74, borderRadius: 10, overflow: "hidden", borderWidth: filter === f.key ? 2 : 1, borderColor: filter === f.key ? colors.white : colors.iron }}>
                  <Image source={{ uri: workingUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
                  {f.overlay ? <View style={[StyleSheet.absoluteFill, { backgroundColor: f.overlay }]} /> : null}
                  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)", paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, color: colors.white, textAlign: "center" }}>{f.label}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Sticker (emoji) picker */}
      {tool === "sticker" ? (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 14, right: 60 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => addSticker(e)} accessibilityLabel={`Sticker ${e}`}>
                <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
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
            <View style={{ height: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Done</Text>
            </View>
          </View>
          {/* Input sits in the upper third so the keyboard never hides it. */}
          <View style={{ position: "absolute", top: insets.top + 90, left: 24, right: 24 }} pointerEvents="box-none">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type…"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoFocus
              multiline
              blurOnSubmit
              style={{ minWidth: 200, fontFamily: "Geist_700Bold", fontSize: 30, color: penColor, textAlign: "center" }}
            />
            <Text style={{ marginTop: 14, textAlign: "center", fontFamily: "GeistMono_400Regular", fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.6)" }}>
              TAP ANYWHERE TO FINISH
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Hint */}
      {selected && Platform.OS !== "web" ? (
        <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 60, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, color: "rgba(255,255,255,0.7)" }}>
            DRAG · PINCH · TWIST · TAP TEXT TO EDIT · DRAG TO TRASH TO DELETE
          </Text>
        </View>
      ) : null}

      {/* Snapchat-style trash: appears only while dragging an element, grows
          when the element hovers it, and dropping there deletes. */}
      {dragging ? (
        <View pointerEvents="none" style={{ position: "absolute", bottom: insets.bottom + 74, left: 0, right: 0, alignItems: "center" }}>
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

      {/* Freeform crop — full-screen overlay; applies to the working image. */}
      {tool === "crop" ? (
        <View style={StyleSheet.absoluteFill}>
          <FreeformCrop
            uri={workingUri}
            onApply={(cropped) => {
              setWorkingUri(cropped);
              setTool("none");
            }}
            onCancel={() => setTool("none")}
          />
        </View>
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
