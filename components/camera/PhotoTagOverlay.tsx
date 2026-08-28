import { Image } from "expo-image";
import { Check, X } from "lucide-react-native";
import { useState } from "react";
import { Platform, Text, useWindowDimensions, View, type LayoutRectangle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { useFriends } from "@/hooks/queries/useFriends";
import { useKeyboardHeight } from "@/hooks/useKeyboardVisible";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

export type PhotoTag = { userId: string; username: string; x: number; y: number };

/**
 * Instagram-style positional photo tagging (M1). Tap anywhere on the photo to
 * pick a friend and drop a tag pill there; pills are draggable and tap-to-
 * remove. Coordinates are stored normalized 0–1 (relative to the frame) so they
 * render at the same spot at any size.
 */
export function PhotoTagOverlay({
  uri,
  initial,
  onDone,
  onClose
}: {
  uri: string;
  initial: PhotoTag[];
  onDone: (tags: PhotoTag[]) => void;
  onClose: () => void;
}) {
  const friends = useFriends();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Explicit keyboard tracking: KAV "padding" on this absolutely-positioned
  // panel double-lifted it (panel floating far above the keyboard with the
  // photo showing through the gap). Pinning bottom to the keyboard top is
  // exact — the same pattern the story reply bar uses.
  const keyboardHeight = useKeyboardHeight();
  const [frame, setFrame] = useState<LayoutRectangle | null>(null);
  const [tags, setTags] = useState<PhotoTag[]>(initial);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (f) => !tags.some((t) => t.userId === f.id) && (!q || `${f.display_name} ${f.username}`.toLowerCase().includes(q))
  );

  const tapPhoto = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (!frame) return;
      setPending({ x: Math.max(0, Math.min(1, e.x / frame.width)), y: Math.max(0, Math.min(1, e.y / frame.height)) });
      setQuery("");
    });

  const place = (userId: string, username: string) => {
    if (!pending) return;
    setTags((prev) => [...prev, { userId, username, x: pending.x, y: pending.y }]);
    setPending(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View
          onLayout={(e) => setFrame(e.nativeEvent.layout)}
          // Same ratio as PostMedia's feed frame (and the capture crop) so the
          // normalized tag coords land on the same spot the feed shows.
          style={{ width: "100%", aspectRatio: 3 / 3.6, overflow: "hidden" }}
        >
          <GestureDetector gesture={tapPhoto}>
            <View style={{ flex: 1 }}>
              <Image source={{ uri }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
              {frame
                ? tags.map((t) => (
                    <DraggablePill
                      key={t.userId}
                      tag={t}
                      frameW={frame.width}
                      frameH={frame.height}
                      onMove={(x, y) => setTags((prev) => prev.map((p) => (p.userId === t.userId ? { ...p, x, y } : p)))}
                      onRemove={() => setTags((prev) => prev.filter((p) => p.userId !== t.userId))}
                    />
                  ))
                : null}
            </View>
          </GestureDetector>
        </View>
        {tags.length === 0 && !pending ? (
          <Text style={{ position: "absolute", fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1, color: "rgba(255,255,255,0.7)" }}>
            TAP THE PHOTO TO TAG
          </Text>
        ) : null}
      </View>

      {/* Top bar: close + done */}
      <View style={{ position: "absolute", top: 50, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable onPress={onClose} accessibilityLabel="Cancel tagging" hitSlop={10}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
            <X size={20} color={colors.white} strokeWidth={2.2} />
          </View>
        </Pressable>
        <Pressable onPress={() => onDone(tags)} accessibilityLabel="Done tagging" hitSlop={10}>
          <View style={{ height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <Check size={17} color={colors.black} strokeWidth={2.6} />
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Done</Text>
          </View>
        </Pressable>
      </View>

      {/* Friend picker — appears after tapping a point on the photo. */}
      {pending ? (
        <Pressable onPress={() => setPending(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // Flush with the keyboard when it's up (iOS; Android resizes the
              // window itself), flush with the screen edge otherwise.
              bottom: Platform.OS === "ios" ? keyboardHeight : 0,
              // Never taller than the space above the keyboard.
              maxHeight: keyboardHeight > 0 ? windowHeight - keyboardHeight - insets.top - 56 : windowHeight * 0.7,
              backgroundColor: tokens.bg.raised,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              // Home-indicator inset when the keyboard is closed — without it
              // the panel ended flush at the screen edge over a black strip.
              paddingBottom: keyboardHeight > 0 ? 8 : insets.bottom + 8
            }}
          >
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.border.strong, marginBottom: 8 }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white, paddingBottom: 8 }}>Tag a friend</Text>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
            </View>
            <View style={{ maxHeight: keyboardHeight > 0 ? 220 : 320 }}>
              {rows.length === 0 ? (
                <Text style={{ paddingTop: 24, paddingBottom: 16, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
                  {q ? "No friends match." : "No more friends to tag."}
                </Text>
              ) : (
                <Animated.ScrollView keyboardShouldPersistTaps="handled">
                  {rows.map((f) => (
                    <ChoiceRow
                      key={f.id}
                      title={f.display_name}
                      sub={`@${f.username}`}
                      left={<Avatar name={f.display_name} uri={f.avatar_url} size={40} />}
                      onPress={() => place(f.id, f.username)}
                    />
                  ))}
                </Animated.ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function DraggablePill({
  tag,
  frameW,
  frameH,
  onMove,
  onRemove
}: {
  tag: PhotoTag;
  frameW: number;
  frameH: number;
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const tx = useSharedValue(tag.x * frameW);
  const ty = useSharedValue(tag.y * frameH);
  const base = useSharedValue({ x: 0, y: 0 });

  const pan = Gesture.Pan()
    .onStart(() => {
      base.value = { x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      tx.value = Math.max(0, Math.min(frameW, base.value.x + e.translationX));
      ty.value = Math.max(0, Math.min(frameH, base.value.y + e.translationY));
    })
    .onEnd(() => {
      runOnJS(onMove)(tx.value / frameW, ty.value / frameH);
    });
  const tap = Gesture.Tap().onEnd(() => runOnJS(onRemove)());
  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }]
  }));

  return (
    <GestureDetector gesture={gesture}>
      {/* Anchored so the pill's left-center sits at the tapped point (-14 lifts
          it onto the point vertically). */}
      <Animated.View style={[{ position: "absolute", top: -14, left: 0 }, style]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 12.5, color: colors.white }}>@{tag.username}</Text>
          <X size={12} color="rgba(255,255,255,0.75)" strokeWidth={2.4} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
