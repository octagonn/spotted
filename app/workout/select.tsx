import { useRouter } from "expo-router";
import { ArrowLeft, Check, Plus, Star } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Segmented } from "@/components/ui/Segmented";
import { Text } from "@/components/ui/Text";
import { ExerciseIcon } from "@/components/workout/ExerciseIcon";
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
import { haptic } from "@/lib/haptics";
import { fuzzyFilter, LIFT_ALIASES } from "@/lib/searchMatch";
import { BASE_LIBRARY, isCardioItem, isSportsItem, MUSCLES, type LibraryItem, type Muscle } from "@/lib/workoutLibrary";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

let _id = Date.now() % 10_000_000;
const uid = () => ++_id;

type Kind = "All" | "Lifts" | "Cardio" | "Sports";

/** Suggested opening weight: 75% of PR rounded to 5s (matches the logger). */
function suggestWeight(bests: Record<string, number>, name: string, fallback: number) {
  const best = bests[name] ?? 0;
  if (best > 0 && !isRepsGraded(name)) return Math.max(45, Math.round((best * 0.75) / 5) * 5);
  return fallback;
}

/** Build a fresh session entry (one unchecked row) from a library item.
 *  "Same as last": last workout's final completed values win over defaults
 *  and over the 75%-of-PR guess — a lift opens at last session's numbers. */
function toEntry(
  item: LibraryItem,
  bests: Record<string, number>,
  lastUsed: Record<string, LastUsedSet>
): WorkoutExercise {
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

/** One library row: icon · name + muscle · ✓ when selected · pin. Selected rows invert to white. */
function LibraryRow({
  item,
  selected,
  pinned,
  onToggle,
  onTogglePin
}: {
  item: LibraryItem;
  selected: boolean;
  pinned: boolean;
  onToggle: () => void;
  onTogglePin: () => void;
}) {
  const kind = isSportsItem(item) ? "sports" : isCardioItem(item) ? "cardio" : "lift";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}${selected ? ", selected" : ""}`}
      onPress={onToggle}
      haptic="selection"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        marginBottom: space[2],
        padding: space[2],
        borderRadius: radius.md,
        backgroundColor: selected ? colors.white : tokens.bg.raised
      }}
    >
      <ExerciseIcon kind={kind} inverted={selected} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="username" numberOfLines={1} className={selected ? "text-black" : ""}>
          {item.name}
        </Text>
        <Text variant="meta" className={selected ? "text-ash" : ""}>
          {item.muscle}
          {item.custom ? " · Custom" : ""}
        </Text>
      </View>
      {selected ? <Check size={icon.size.sm - 2} color={colors.black} strokeWidth={icon.stroke.bold} /> : null}
      {/* pin/unpin — nested Pressable so it never toggles selection */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinned ? `Unpin ${item.name}` : `Pin ${item.name} to the top`}
        onPress={onTogglePin}
        haptic="selection"
        hitSlop={10}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
      >
        <Star
          size={icon.size.sm - 2}
          color={pinned ? tokens.accent.gold : selected ? colors.ash : tokens.text.tertiary}
          fill={pinned ? tokens.accent.gold : "transparent"}
          strokeWidth={icon.stroke.regular}
        />
      </Pressable>
    </Pressable>
  );
}

/**
 * SELECT EXERCISES — search + filter chips, "Add custom exercise" row,
 * alphabetical sections with a Pinned section, multi-select, floating ADD (n)
 * button. Adding pushes the chosen exercises into the live session and pops
 * back to the logger.
 */
export default function SelectExercisesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("All");
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
      // Fuzzy-ranked, but pinned exercises float above the rest.
      const ranked = fuzzyFilter(
        pool,
        q,
        (l) => l.name,
        (l) => LIFT_ALIASES[l.name]
      );
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
  };

  const addSelected = () => {
    if (selected.size === 0) return;
    const state = useWorkoutSession.getState();
    const bests = state.bests;
    state.setExercises((prev) => {
      const next = [...prev];
      for (const item of selected.values()) {
        const itemKind = isCardioItem(item) ? "cardio" : "lift";
        const idx = next.findIndex((e) => e.name === item.name && e.kind === itemKind);
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
    haptic("impact");
    if (router.canGoBack()) router.back();
    else router.replace("/workout" as never);
  };

  // The custom-exercise form renders INSIDE this screen, so backing out of it
  // returns to the library rather than popping the whole picker. Guarded
  // against a double-tap popping two screens.
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

  const renderRow = (item: LibraryItem) => (
    <LibraryRow
      key={item.name}
      item={item}
      selected={selected.has(item.name)}
      pinned={favSet.has(item.name)}
      onToggle={() => toggle(item)}
      onTogglePin={() => toggleFavorite.mutate({ name: item.name, favorite: !favSet.has(item.name) })}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* header: back · title · live selection count */}
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingHorizontal: space[4],
          paddingBottom: space[3],
          flexDirection: "row",
          alignItems: "center"
        }}
      >
        {custom ? (
          <Pressable
            accessibilityLabel="Back to library"
            onPress={goBack}
            haptic="none"
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: tokens.border.default,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <ArrowLeft size={icon.size.xs + 2} color={colors.mist} strokeWidth={icon.stroke.bold} />
          </Pressable>
        ) : (
          <BackButton fallback="/workout" />
        )}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text variant="subheading">{custom ? "Custom exercise" : "Select exercises"}</Text>
        </View>
        <View style={{ width: 34, alignItems: "center" }}>
          {selected.size > 0 ? (
            <View
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: radius.pill,
                paddingHorizontal: 6,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text variant="numeral-sm" className="text-black text-[12px] leading-[16px]">
                {String(selected.size)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {custom ? (
        /* ---------------------- custom exercise form ---------------------- */
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: space[4],
              paddingTop: space[2],
              paddingBottom: insets.bottom + space[6]
            }}
          >
            <SectionLabel style={{ marginBottom: space[2] }}>Name</SectionLabel>
            <TextInput
              value={custom.name}
              onChangeText={(name) => setCustom((c) => (c ? { ...c, name } : c))}
              placeholder="e.g. Zercher Squat"
              placeholderTextColor={tokens.text.tertiary}
              maxLength={48}
              autoFocus
              accessibilityLabel="Exercise name"
              style={{
                paddingHorizontal: space[4],
                height: 48,
                borderRadius: radius.sm,
                backgroundColor: tokens.bg.raised,
                borderWidth: 1,
                borderColor: tokens.border.default,
                fontFamily: "Geist_400Regular",
                fontSize: 15,
                color: tokens.text.primary
              }}
            />

            <SectionLabel style={{ marginTop: space[6], marginBottom: space[2] }}>Category</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              {MUSCLES.map((m) => (
                <Chip
                  key={m}
                  selected={custom.muscle === m}
                  onPress={() => setCustom((c) => (c ? { ...c, muscle: m } : c))}
                >
                  {m}
                </Chip>
              ))}
            </View>

            {custom.muscle === "Cardio" ? (
              <>
                <SectionLabel style={{ marginTop: space[6], marginBottom: space[2] }}>Incline</SectionLabel>
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  <Chip selected={!custom.inc} onPress={() => setCustom((c) => (c ? { ...c, inc: false } : c))}>
                    Off
                  </Chip>
                  <Chip selected={custom.inc} onPress={() => setCustom((c) => (c ? { ...c, inc: true } : c))}>
                    Track incline %
                  </Chip>
                </View>
              </>
            ) : null}

            <Text variant="meta" className="mt-4">
              {custom.muscle === "Cardio"
                ? `Logged in minutes, miles${custom.inc ? ", and incline %" : ""}.`
                : custom.muscle === "Sports"
                  ? "Logged in minutes and miles — a game counts as a workout."
                  : "Logged in reps and pounds."}
            </Text>
          </ScrollView>

          {/* pinned save — always visible, above the keyboard */}
          <View
            style={{
              paddingHorizontal: space[4],
              paddingTop: space[2],
              paddingBottom: insets.bottom > 0 ? insets.bottom + space[2] : space[4]
            }}
          >
            <Button onPress={submitCustom} disabled={!custom.name.trim()}>
              Save exercise
            </Button>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* --------------------------- library list -------------------------- */
        <>
          <View style={{ paddingHorizontal: space[4] }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search for an exercise…" />
          </View>

          <Segmented
            options={["All", "Lifts", "Cardio", "Sports"]}
            value={kind}
            onChange={(v) => setKind(v as Kind)}
            variant="quiet"
            style={{ marginTop: space[3], marginBottom: 0 }}
          />

          {/* Muscle-group filters — always visible ("All" default). */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], alignItems: "center" }}
            // flexShrink 0 + explicit height: the column squeezed this row when
            // the list below needed space, clipping the chips vertically.
            style={{ flexGrow: 0, flexShrink: 0, height: 36, marginVertical: space[2] }}
          >
            {(["All", ...MUSCLES] as const).map((m) => (
              <Chip key={m} selected={group === m} onPress={() => setGroup(m)}>
                {m}
              </Chip>
            ))}
          </ScrollView>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: insets.bottom + 110 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add custom exercise"
              haptic="none"
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
                gap: space[3],
                padding: space[2],
                marginBottom: space[4],
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: tokens.border.strong
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.sm,
                  backgroundColor: tokens.bg.subtle,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Plus size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.bold} />
              </View>
              <Text variant="username" className="flex-1">
                Add custom exercise
              </Text>
            </Pressable>

            {sections
              ? sections.map(([letter, items]) => (
                  <View key={letter} style={{ marginBottom: space[2] }}>
                    <View
                      style={{ marginBottom: space[2], flexDirection: "row", alignItems: "center", gap: space[1] + 1 }}
                    >
                      {letter === "Pinned" ? (
                        <Star
                          size={12}
                          color={tokens.accent.gold}
                          fill={tokens.accent.gold}
                          strokeWidth={icon.stroke.regular}
                        />
                      ) : null}
                      <Text variant="meta-strong" className={letter === "Pinned" ? "text-gold" : ""}>
                        {letter}
                      </Text>
                    </View>
                    {items.map(renderRow)}
                  </View>
                ))
              : results.map(renderRow)}
            {results.length === 0 ? (
              <View style={{ paddingVertical: space[6], alignItems: "center" }}>
                <Text variant="meta" className="text-center">
                  &ldquo;{query.trim()}&rdquo; isn&apos;t in the library — add it as a custom exercise above.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* floating ADD — bottom right. The dark halo keeps the white pill
              visible even directly over a white selected row. */}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              right: space[4],
              bottom: insets.bottom > 0 ? insets.bottom + space[2] : space[4],
              alignItems: "flex-end"
            }}
          >
            <View style={{ borderRadius: radius.pill, padding: space[1], backgroundColor: tokens.bg.scrim }}>
              <Button
                icon={
                  <Plus
                    size={icon.size.xs}
                    color={selected.size > 0 ? colors.black : colors.bone}
                    strokeWidth={icon.stroke.bold}
                  />
                }
                variant={selected.size > 0 ? "solid" : "ghost"}
                disabled={selected.size === 0}
                onPress={addSelected}
                accessibilityLabel={selected.size > 0 ? `Add ${selected.size} selected exercises` : "Add"}
                style={{ borderRadius: radius.pill, paddingHorizontal: space[6] }}
              >
                {selected.size > 0 ? `Add (${selected.size})` : "Add"}
              </Button>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
