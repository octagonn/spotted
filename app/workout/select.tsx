import { useRouter } from "expo-router";
import { Activity, ArrowLeft, Check, Dumbbell, Flame, Plus, Search, Star, X } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Segmented } from "@/components/ui/Segmented";
import { DISP, MED, NUM, SEMI, W } from "@/components/workout/wtheme";
import { useCustomExercises, useSaveCustomExercise } from "@/hooks/queries/useCustomExercises";
import { useExerciseFavorites, useToggleExerciseFavorite } from "@/hooks/queries/useExerciseFavorites";
import {
  deriveLastUsed,
  isRepsGraded,
  useWorkouts,
  type CardioSet,
  type LastUsedSet,
  type LiftSet,
  type WorkoutExercise
} from "@/hooks/queries/useWorkouts";
import { impactHaptic } from "@/lib/haptics";
import { fuzzyFilter, LIFT_ALIASES } from "@/lib/searchMatch";
import { BASE_LIBRARY, isCardioItem, isSportsItem, MUSCLES, type LibraryItem, type Muscle } from "@/lib/workoutLibrary";
import { useAuthStore } from "@/stores/auth";
import { useWorkoutSession } from "@/stores/workoutSession";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

let _id = Date.now() % 10_000_000;
const uid = () => ++_id;

function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        { fontFamily: MED, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: W.faint },
        style
      ]}
    >
      {children}
    </Text>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? W.text : W.card,
        borderWidth: 1,
        borderColor: selected ? W.text : W.line
      }}
    >
      <Text style={{ fontFamily: SEMI, fontSize: 12, color: selected ? W.ink : W.muted }}>{label}</Text>
    </Pressable>
  );
}

/** Suggested opening weight: 75% of PR rounded to 5s (matches the logger). */
function suggestWeight(bests: Record<string, number>, name: string, fallback: number) {
  const best = bests[name] ?? 0;
  if (best > 0 && !isRepsGraded(name)) return Math.max(45, Math.round((best * 0.75) / 5) * 5);
  return fallback;
}

/** Build a fresh session entry (one unchecked row) from a library item.
 *  "Same as last": last workout's final completed values win over defaults
 *  and over the 75%-of-PR guess — a lift opens at last session's numbers. */
function toEntry(item: LibraryItem, bests: Record<string, number>, lastUsed: Record<string, LastUsedSet>): WorkoutExercise {
  const last = lastUsed[item.name];
  if (isCardioItem(item)) {
    const lastCardio = last?.kind === "cardio" ? last : null;
    return {
      id: uid(),
      name: item.name,
      muscle: item.muscle,
      kind: "cardio",
      defMin: item.min ?? 20,
      defMi: item.mi ?? 0,
      hasInc: item.inc !== undefined,
      defInc: item.inc,
      sets: [
        {
          id: uid(),
          min: lastCardio?.min ?? item.min ?? 20,
          mi: lastCardio?.mi ?? item.mi ?? 0,
          ...(item.inc !== undefined ? { inc: lastCardio?.inc ?? item.inc } : {}),
          done: false
        } as CardioSet
      ]
    };
  }
  const lastLift = last?.kind === "lift" ? last : null;
  return {
    id: uid(),
    name: item.name,
    muscle: item.muscle,
    kind: "lift",
    defW: item.w ?? 45,
    defR: item.r ?? 10,
    sets: [
      {
        id: uid(),
        w: lastLift?.w ?? suggestWeight(bests, item.name, item.w ?? 45),
        r: lastLift?.r ?? item.r ?? 10,
        done: false
      } as LiftSet
    ]
  };
}

/**
 * SELECT EXERCISES — WHOOP-style full screen in app styling: search + filter
 * chips, dashed "Add Custom Exercise" row, alphabetical sections, multi-select
 * (selected rows invert to white), floating ADD (n) bar. Adding pushes the
 * chosen exercises into the live session and pops back to the builder.
 */
export default function SelectExercisesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  /** Gym vs cardio split — the old two-tile choice, as a segmented control. */
  const [kind, setKind] = useState<"All" | "Lifts" | "Cardio" | "Sports">("All");
  const [group, setGroup] = useState<"All" | Muscle>("All");
  const [selected, setSelected] = useState<Map<string, LibraryItem>>(new Map());
  const [custom, setCustom] = useState<{ name: string; muscle: Muscle; inc: boolean } | null>(null);
  // Just-created customs (instant) — the server list is the durable copy that
  // brings them back in every future workout.
  const [customItems, setCustomItems] = useState<LibraryItem[]>([]);
  const savedCustoms = useCustomExercises();
  const saveCustom = useSaveCustomExercise();
  // "Same as last": seed re-added exercises from the most recent workout.
  const sessionUserId = useAuthStore((state) => state.userId);
  const workouts = useWorkouts(sessionUserId);
  const lastUsed = useMemo(() => deriveLastUsed(workouts.data), [workouts.data]);

  const library = useMemo(() => {
    const seen = new Set(BASE_LIBRARY.map((l) => l.name));
    const extras: LibraryItem[] = [];
    for (const item of [...customItems, ...(savedCustoms.data ?? [])]) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      extras.push(item);
    }
    return [...BASE_LIBRARY, ...extras];
  }, [customItems, savedCustoms.data]);
  const favorites = useExerciseFavorites();
  const toggleFavorite = useToggleExerciseFavorite();
  const favSet = favorites.data ?? new Set<string>();

  const results = useMemo(() => {
    let pool = library;
    if (kind === "Lifts") pool = pool.filter((l) => !isCardioItem(l));
    else if (kind === "Cardio") pool = pool.filter((l) => isCardioItem(l) && !isSportsItem(l));
    else if (kind === "Sports") pool = pool.filter(isSportsItem);
    if (group === "Cardio") pool = pool.filter(isCardioItem);
    else if (group !== "All") pool = pool.filter((l) => l.muscle === group);
    const q = query.trim();
    const favs = favorites.data ?? new Set<string>();
    if (q) {
      // Fuzzy-ranked, but pinned exercises float above the rest (stable within
      // each partition so relevance order is preserved).
      const ranked = fuzzyFilter(pool, q, (l) => l.name, (l) => LIFT_ALIASES[l.name]);
      return [...ranked.filter((l) => favs.has(l.name)), ...ranked.filter((l) => !favs.has(l.name))];
    }
    return [...pool].sort((a, b) => a.name.localeCompare(b.name));
  }, [library, kind, group, query, favorites.data]);

  /** Alphabetical letter sections with a Pinned section on top (skipped while
   *  searching — ranked order wins there). */
  const sections = useMemo(() => {
    if (query.trim()) return null;
    const favs = favorites.data ?? new Set<string>();
    const map = new Map<string, LibraryItem[]>();
    for (const item of results) {
      const letter = /^[A-Za-z]/.test(item.name) ? item.name[0].toUpperCase() : "#";
      const list = map.get(letter) ?? [];
      list.push(item);
      map.set(letter, list);
    }
    const entries: [string, LibraryItem[]][] = [...map.entries()];
    const pinned = results.filter((l) => favs.has(l.name));
    return pinned.length > 0 ? ([["Pinned", pinned], ...entries] as [string, LibraryItem[]][]) : entries;
  }, [results, query, favorites.data]);

  const toggle = (item: LibraryItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.name)) next.delete(item.name);
      else next.set(item.name, item);
      return next;
    });
    void impactHaptic();
  };

  const addSelected = () => {
    if (selected.size === 0) return;
    const state = useWorkoutSession.getState();
    const bests = state.bests;
    state.setExercises((prev) => {
      const next = [...prev];
      for (const item of selected.values()) {
        const kind = isCardioItem(item) ? "cardio" : "lift";
        const idx = next.findIndex((e) => e.name === item.name && e.kind === kind);
        if (idx >= 0) {
          // Already in the workout — append one cloned row instead.
          const existing = next[idx];
          if (existing.kind === "cardio") {
            const last = existing.sets[existing.sets.length - 1];
            const set: CardioSet = {
              id: uid(),
              min: last?.min ?? existing.defMin,
              mi: last?.mi ?? existing.defMi,
              ...(existing.hasInc ? { inc: last?.inc ?? existing.defInc ?? 0 } : {}),
              done: false
            };
            next[idx] = { ...existing, sets: [...existing.sets, set] };
          } else {
            const last = existing.sets[existing.sets.length - 1];
            const set: LiftSet = { id: uid(), w: last?.w ?? existing.defW, r: last?.r ?? existing.defR, done: false };
            next[idx] = { ...existing, sets: [...existing.sets, set] };
          }
        } else {
          next.push(toEntry(item, bests, lastUsed));
        }
      }
      return next;
    });
    void impactHaptic();
    if (router.canGoBack()) router.back();
    else router.replace("/workout" as never);
  };

  // The custom-exercise form renders INSIDE this screen, so backing out of it
  // should return to the library rather than popping the whole picker (which
  // silently threw away what you were typing). Also guarded against a
  // double-tap popping two screens.
  const leaving = useRef(false);
  const goBack = () => {
    if (custom) {
      setCustom(null);
      return;
    }
    if (leaving.current) return;
    leaving.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/workout" as never);
    setTimeout(() => {
      leaving.current = false;
    }, 600);
  };

  const submitCustom = () => {
    if (!custom || !custom.name.trim()) return;
    // Cardio AND Sports are activity-kind (minutes/miles); incline is cardio-only.
    const activity = custom.muscle === "Cardio" || custom.muscle === "Sports";
    const item: LibraryItem = activity
      ? {
          name: custom.name.trim(),
          muscle: custom.muscle,
          min: custom.muscle === "Sports" ? 60 : 20,
          mi: 0,
          ...(custom.inc && custom.muscle === "Cardio" ? { inc: 1 } : {}),
          custom: true
        }
      : { name: custom.name.trim(), muscle: custom.muscle, w: 45, r: 10, custom: true };
    setCustomItems((prev) => (prev.some((c) => c.name === item.name) ? prev : [...prev, item]));
    setSelected((prev) => new Map(prev).set(item.name, item));
    // Persist so it's still in the list next workout (fire-and-forget).
    saveCustom.mutate(item);
    setCustom(null);
    showToast(`${item.name} added to your selection`);
  };

  const row = (item: LibraryItem) => {
    const isSel = selected.has(item.name);
    const isFav = favSet.has(item.name);
    const Icon = isSportsItem(item) ? Activity : isCardioItem(item) ? Flame : Dumbbell;
    return (
      <Pressable
        key={item.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isSel }}
        accessibilityLabel={`${item.name}${isSel ? ", selected" : ""}`}
        onPress={() => toggle(item)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
          padding: 10,
          borderRadius: radius.md,
          backgroundColor: isSel ? W.text : W.card,
          borderWidth: 1,
          borderColor: isSel ? W.text : W.line
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            backgroundColor: isSel ? "rgba(0,0,0,0.1)" : W.card2,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Icon size={19} color={isSel ? W.ink : W.text} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: SEMI, fontSize: 15, color: isSel ? W.ink : W.text }}>
            {item.name}
          </Text>
          <Text style={{ marginTop: 1, fontFamily: "Geist_400Regular", fontSize: 12, color: isSel ? "rgba(0,0,0,0.55)" : W.faint }}>
            {item.muscle}
            {item.custom ? " · Custom" : ""}
          </Text>
        </View>
        {isSel ? <Check size={18} color={W.ink} strokeWidth={2.6} /> : null}
        {/* pin/unpin — nested Pressable so it never toggles selection */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFav ? `Unpin ${item.name}` : `Pin ${item.name} to the top`}
          onPress={() => {
            toggleFavorite.mutate({ name: item.name, favorite: !isFav });
            void impactHaptic();
          }}
          hitSlop={10}
          style={{ paddingLeft: 4, paddingVertical: 4 }}
        >
          <Star
            size={18}
            color={isFav ? tokens.accent.gold : isSel ? "rgba(0,0,0,0.4)" : W.faint}
            fill={isFav ? tokens.accent.gold : "transparent"}
            strokeWidth={2}
          />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: W.ink }}>
      {/* header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center"
        }}
      >
        <Pressable
          accessibilityLabel="Back"
          onPress={goBack}
          hitSlop={8}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: W.line,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <ArrowLeft size={17} color={W.muted} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontFamily: DISP, fontSize: 17, letterSpacing: 17 * -0.01, color: W.text }}>
            Select exercises
          </Text>
        </View>
        {/* balance the back button; shows live selection count */}
        <View style={{ width: 34, alignItems: "center" }}>
          {selected.size > 0 ? (
            <View
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: 12,
                paddingHorizontal: 6,
                backgroundColor: W.text,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontFamily: NUM, fontSize: 12, color: W.ink }}>{selected.size}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {custom ? (
        /* ---------------------- custom exercise form ---------------------- */
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 24 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCustom(null)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}
            >
              <ArrowLeft size={14} color={W.muted} />
              <Text style={{ fontFamily: SEMI, fontSize: 12, color: W.muted }}>Back to library</Text>
            </Pressable>
            <Text style={{ fontFamily: NUM, fontSize: 20, color: W.text }}>Custom exercise</Text>

            <View style={{ marginTop: 16, marginBottom: 6 }}>
              <Micro>Name</Micro>
            </View>
            <TextInput
              value={custom.name}
              onChangeText={(name) => setCustom((c) => (c ? { ...c, name } : c))}
              placeholder="e.g. Zercher Squat"
              placeholderTextColor={W.faint}
              maxLength={48}
              autoFocus
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: radius.sm,
                backgroundColor: W.card,
                borderWidth: 1,
                borderColor: W.line,
                fontFamily: "Geist_400Regular",
                fontSize: 15,
                color: W.text
              }}
            />

            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <Micro>Category</Micro>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {MUSCLES.map((m) => (
                <Chip key={m} label={m} selected={custom.muscle === m} onPress={() => setCustom((c) => (c ? { ...c, muscle: m } : c))} />
              ))}
            </View>

            {custom.muscle === "Cardio" ? (
              <>
                <View style={{ marginTop: 16, marginBottom: 8 }}>
                  <Micro>Incline</Micro>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Chip label="Off" selected={!custom.inc} onPress={() => setCustom((c) => (c ? { ...c, inc: false } : c))} />
                  <Chip
                    label="On — track incline %"
                    selected={custom.inc}
                    onPress={() => setCustom((c) => (c ? { ...c, inc: true } : c))}
                  />
                </View>
              </>
            ) : null}

            <Text style={{ marginTop: 12, fontFamily: "Geist_400Regular", fontSize: 12.5, lineHeight: 18, color: W.muted }}>
              {custom.muscle === "Cardio"
                ? `Logged in minutes, miles${custom.inc ? ", and incline %" : ""}.`
                : custom.muscle === "Sports"
                  ? "Logged in minutes and miles — a game counts as a workout."
                  : "Logged in reps and pounds."}
            </Text>
          </ScrollView>

          {/* pinned save — always visible, above the keyboard */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }}>
            <Pressable
              accessibilityRole="button"
              onPress={submitCustom}
              disabled={!custom.name.trim()}
              style={{
                paddingVertical: 15,
                borderRadius: radius.pill,
                backgroundColor: custom.name.trim() ? colors.white : tokens.bg.subtle,
                borderWidth: 1,
                borderColor: custom.name.trim() ? colors.white : tokens.border.strong,
                alignItems: "center"
              }}
            >
              <Text
                style={{
                  fontFamily: NUM,
                  fontSize: 14.5,
                  letterSpacing: 0.14,
                  color: custom.name.trim() ? colors.black : W.muted
                }}
              >
                Save exercise
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* --------------------------- library list -------------------------- */
        <>
          {/* search + filter */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: radius.md,
                backgroundColor: W.card,
                borderWidth: 1,
                borderColor: W.line
              }}
            >
              <Search size={16} color={W.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search for an exercise…"
                placeholderTextColor={W.faint}
                style={{ flex: 1, fontFamily: "Geist_400Regular", fontSize: 14.5, color: W.text, padding: 0 }}
              />
              {query ? (
                <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={8}>
                  <X size={15} color={W.faint} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* gym vs cardio — the old section split, as a segmented control */}
          <Segmented
            options={["All", "Lifts", "Cardio", "Sports"]}
            value={kind}
            onChange={(v) => setKind(v as "All" | "Lifts" | "Cardio" | "Sports")}
            style={{ marginTop: 12, marginBottom: 0 }}
          />

          {/* Muscle-group filters — always visible ("All" default), with a
              small, EQUAL breath of space above and below. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16, alignItems: "center" }}
            // flexShrink 0 + explicit height: the column squeezed this row when
            // the list below needed space, clipping the chips vertically.
            style={{ flexGrow: 0, flexShrink: 0, height: 36, marginVertical: 8 }}
          >
            {(["All", ...MUSCLES] as const).map((m) => (
              <Chip key={m} label={m} selected={group === m} onPress={() => setGroup(m)} />
            ))}
          </ScrollView>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: insets.bottom + 110 }}
          >
            {/* custom exercise row (solid border — RN iOS won't render dashed
                borders on rounded rects) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add custom exercise"
              onPress={() =>
                setCustom({
                  name: query.trim(),
                  muscle:
                    group !== "All" && group !== "Cardio"
                      ? group
                      : group === "Cardio" || kind === "Cardio"
                        ? "Cardio"
                        : "Chest",
                  inc: false
                })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 10,
                marginBottom: 16,
                borderRadius: radius.md,
                backgroundColor: W.card,
                borderWidth: 1,
                borderColor: W.strong
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.sm,
                  backgroundColor: W.card2,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Plus size={19} color={W.text} strokeWidth={2.2} />
              </View>
              <Text style={{ flex: 1, fontFamily: SEMI, fontSize: 15, color: W.text }}>Add Custom Exercise</Text>
            </Pressable>

            {sections
              ? sections.map(([letter, items]) => (
                  <View key={letter} style={{ marginBottom: 8 }}>
                    <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      {letter === "Pinned" ? (
                        <Star size={12} color={tokens.accent.gold} fill={tokens.accent.gold} strokeWidth={2} />
                      ) : null}
                      <Text
                        style={{
                          fontFamily: SEMI,
                          fontSize: 13,
                          color: letter === "Pinned" ? tokens.accent.gold : W.muted
                        }}
                      >
                        {letter}
                      </Text>
                    </View>
                    {items.map(row)}
                  </View>
                ))
              : results.map(row)}
            {results.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ fontFamily: "Geist_400Regular", fontSize: 14, color: W.muted, textAlign: "center" }}>
                  &ldquo;{query.trim()}&rdquo; isn&apos;t in the library — add it as a custom exercise above.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* floating ADD bubble — bottom right. The dark halo ring keeps the
              white pill visible even directly over a white selected row. */}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              right: 16,
              bottom: insets.bottom > 0 ? insets.bottom + 8 : 18,
              alignItems: "flex-end"
            }}
          >
            <View
              style={{
                borderRadius: radius.pill,
                padding: 4,
                backgroundColor: "rgba(9,9,11,0.9)",
                shadowColor: "#000000",
                shadowOpacity: 0.45,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 10
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selected.size > 0 ? `Add ${selected.size} selected exercises` : "Add"}
                onPress={addSelected}
                disabled={selected.size === 0}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: radius.pill,
                  backgroundColor: selected.size > 0 ? colors.white : tokens.bg.subtle
                }}
              >
                <Plus size={16} color={selected.size > 0 ? colors.black : W.muted} strokeWidth={2.6} />
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: NUM,
                    fontSize: 14.5,
                    letterSpacing: 0.14,
                    color: selected.size > 0 ? colors.black : W.muted
                  }}
                >
                  {selected.size > 0 ? `Add (${selected.size})` : "Add"}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
