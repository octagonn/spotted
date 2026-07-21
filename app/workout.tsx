import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Dumbbell,
  Flame,
  Minus,
  Plus,
  Search,
  Trash2,
  Trophy,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrophyUnlockModal } from "@/components/trophies/TrophyUnlockModal";
import type { TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { useSaveWorkout, type CardioSet, type LiftSet, type WorkoutExercise } from "@/hooks/queries/useWorkouts";
import { selectionHaptic } from "@/lib/haptics";
import {
  BASE_LIBRARY,
  FIELD_CFG,
  fmtClock,
  fmtMiles,
  fmtWeight,
  isCardioItem,
  LIFT_MUSCLES,
  MUSCLES,
  type FieldKey,
  type LibraryItem,
  type Muscle
} from "@/lib/workoutLibrary";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const DANGER = "#FF5C5C";
const DISP = "Geist_700Bold";
const NUM = "GeistMono_500Medium";

type SheetState =
  | null
  | { type: "picker"; mode: "types" }
  | { type: "picker"; mode: "list"; wtype: "lift" | "cardio" }
  | { type: "editor"; exId: number; setId: number; field: FieldKey };

type CustomState = { name: string; inc: boolean; muscle: Muscle } | null;

let _id = 0;
const uid = () => ++_id;

/** The pulsing "Live" dot in the header (prototype .pulse-dot). */
function PulseDot() {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      o.value = 1;
      return;
    }
    o.value = withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: radius.pill, backgroundColor: tokens.accent.gold }, style]} />;
}

/** Tiny uppercase section label (an allowed caps case). */
function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        { fontFamily: "Geist_600SemiBold", fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: tokens.text.tertiary },
        style
      ]}
    >
      {children}
    </Text>
  );
}

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const saveWorkout = useSaveWorkout();

  const [name, setName] = useState("Workout");
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [library, setLibrary] = useState<LibraryItem[]>(BASE_LIBRARY);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState<SheetState>(null);
  const [custom, setCustom] = useState<CustomState>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("All");
  const [rest, setRest] = useState<{ left: number; total: number } | null>(null);
  const [finished, setFinished] = useState<{
    dur: number;
    vol: number;
    sets: number;
    cardioMin: number;
    exCount: number;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [celebrations, setCelebrations] = useState<TrophyShareData[]>([]);
  const [celebrateIdx, setCelebrateIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  // Elapsed clock.
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // Rest countdown.
  useEffect(() => {
    if (!rest) return;
    if (rest.left <= 0) {
      setRest(null);
      return;
    }
    const t = setTimeout(() => setRest((r) => (r ? { ...r, left: r.left - 1 } : null)), 1000);
    return () => clearTimeout(t);
  }, [rest]);

  const totals = useMemo(() => {
    let vol = 0;
    let done = 0;
    let all = 0;
    let cardioMin = 0;
    exercises.forEach((ex) =>
      ex.sets.forEach((s) => {
        all += 1;
        if (!s.done) return;
        done += 1;
        if (ex.kind === "cardio") cardioMin += (s as CardioSet).min;
        else vol += (s as LiftSet).w * (s as LiftSet).r;
      })
    );
    return { vol, done, all, cardioMin };
  }, [exercises]);

  const liftCount = useMemo(() => library.filter((l) => !isCardioItem(l)).length, [library]);
  const cardioCount = library.length - liftCount;

  const patchSet = (exId: number, setId: number, fn: (s: LiftSet | CardioSet) => LiftSet | CardioSet) =>
    setExercises((xs) =>
      xs.map((x) =>
        x.id !== exId ? x : ({ ...x, sets: x.sets.map((s) => (s.id !== setId ? s : fn(s))) } as WorkoutExercise)
      )
    );

  const toggleDone = (exId: number, setId: number) => {
    let turnedOn = false;
    patchSet(exId, setId, (s) => {
      turnedOn = !s.done;
      return { ...s, done: !s.done };
    });
    void selectionHaptic();
    if (turnedOn) setRest({ left: 90, total: 90 });
  };

  const addSet = (ex: WorkoutExercise) => {
    setExercises((xs) =>
      xs.map((x) => {
        if (x.id !== ex.id) return x;
        const last = x.sets[x.sets.length - 1];
        if (x.kind === "cardio") {
          const l = last as CardioSet | undefined;
          const s: CardioSet = {
            id: uid(),
            min: l ? l.min : x.defMin,
            mi: l ? l.mi : x.defMi,
            ...(x.hasInc ? { inc: l ? l.inc : x.defInc } : {}),
            done: false
          };
          return { ...x, sets: [...x.sets, s] };
        }
        const l = last as LiftSet | undefined;
        const s: LiftSet = { id: uid(), w: l ? l.w : x.defW, r: l ? l.r : x.defR, done: false };
        return { ...x, sets: [...x.sets, s] };
      })
    );
  };

  const removeSet = (exId: number, setId: number) => {
    setExercises((xs) =>
      xs.map((x) => (x.id !== exId ? x : ({ ...x, sets: x.sets.filter((s) => s.id !== setId) } as WorkoutExercise)))
    );
    setSheet(null);
  };

  const removeExercise = (exId: number) => setExercises((xs) => xs.filter((x) => x.id !== exId));

  const addExercise = (item: LibraryItem) => {
    const cardio = isCardioItem(item);
    setExercises((xs) => [
      ...xs,
      cardio
        ? {
            id: uid(),
            name: item.name,
            muscle: item.muscle,
            kind: "cardio",
            defMin: item.min ?? 20,
            defMi: item.mi ?? 0,
            hasInc: item.inc !== undefined,
            defInc: item.inc,
            sets: [{ id: uid(), min: item.min ?? 20, mi: item.mi ?? 0, ...(item.inc !== undefined ? { inc: item.inc } : {}), done: false }]
          }
        : {
            id: uid(),
            name: item.name,
            muscle: item.muscle,
            kind: "lift",
            defW: item.w ?? 45,
            defR: item.r ?? 10,
            sets: [{ id: uid(), w: item.w ?? 45, r: item.r ?? 10, done: false }]
          }
    ]);
    setSheet(null);
    setQuery("");
    setCustom(null);
    setGroup("All");
  };

  const createCustom = () => {
    if (!custom || !custom.name.trim()) return;
    const cardio = custom.muscle === "Cardio";
    const item: LibraryItem = cardio
      ? { name: custom.name.trim(), muscle: "Cardio", min: 20, mi: 0, ...(custom.inc ? { inc: 1 } : {}), custom: true }
      : { name: custom.name.trim(), muscle: custom.muscle, w: 45, r: 10, custom: true };
    setLibrary((lib) => [...lib, item]);
    addExercise(item);
  };

  const finishWorkout = async () => {
    if (totals.done === 0 || !userId || saving) return;
    setSaving(true);
    const summary = {
      dur: elapsed,
      vol: totals.vol,
      sets: totals.done,
      cardioMin: totals.cardioMin,
      exCount: exercises.filter((e) => e.sets.some((s) => s.done)).length
    };
    setRest(null);
    try {
      const result = await saveWorkout.mutateAsync({
        userId,
        name,
        startedAt,
        durationSeconds: elapsed,
        exercises
      });
      setCelebrations(result.celebrations);
      setCelebrateIdx(0);
      setFinished(summary);
    } catch {
      showToast("Couldn't save your workout — check your connection");
    } finally {
      setSaving(false);
    }
  };

  const resetWorkout = () => {
    setExercises([]);
    setFinished(null);
    setRest(null);
    setCollapsed({});
    setCelebrations([]);
    router.back();
  };

  const openPicker = (wtype: "lift" | "cardio" | null) => {
    setSheet(wtype ? { type: "picker", mode: "list", wtype } : { type: "picker", mode: "types" });
    setQuery("");
    setGroup("All");
    setCustom(null);
  };
  const closeSheet = () => {
    setSheet(null);
    setCustom(null);
    setQuery("");
    setGroup("All");
  };
  const openCustom = () =>
    setCustom({
      name: query.trim(),
      inc: false,
      muscle: sheet && sheet.type === "picker" && sheet.mode === "list" && sheet.wtype === "cardio" ? "Cardio" : "Chest"
    });

  const pickerList = sheet && sheet.type === "picker" && sheet.mode === "list" ? sheet : null;
  const results = useMemo(() => {
    if (!pickerList) return [];
    const q = query.trim().toLowerCase();
    const pool = library.filter((l) => (pickerList.wtype === "cardio") === isCardioItem(l));
    if (q) return pool.filter((l) => l.name.toLowerCase().includes(q));
    if (pickerList.wtype === "lift" && group !== "All") return pool.filter((l) => l.muscle === group);
    return pool;
  }, [query, library, pickerList, group]);

  const editing = useMemo(() => {
    if (!sheet || sheet.type !== "editor") return null;
    const ex = exercises.find((x) => x.id === sheet.exId);
    if (!ex) return null;
    const idx = ex.sets.findIndex((s) => s.id === sheet.setId);
    if (idx < 0) return null;
    return { ex, set: ex.sets[idx], idx };
  }, [sheet, exercises]);

  const cfg = sheet && sheet.type === "editor" ? FIELD_CFG[sheet.field] : null;

  const applyVal = (v: number) => {
    if (!editing || !sheet || sheet.type !== "editor") return;
    const field = sheet.field;
    patchSet(editing.ex.id, editing.set.id, (s) => ({ ...s, [field]: v }));
    setDraft(String(v));
  };
  const bump = (delta: number) => {
    if (!editing || !cfg || !sheet || sheet.type !== "editor") return;
    const current = (editing.set as unknown as Record<string, number>)[sheet.field] ?? 0;
    applyVal(Math.max(cfg.min, Math.round((current + delta) * 10) / 10));
  };
  const typeVal = (raw: string) => {
    if (!editing || !cfg || !sheet || sheet.type !== "editor") return;
    const intOnly = sheet.field === "r" || sheet.field === "min";
    let clean = raw.replace(intOnly ? /[^0-9]/g : /[^0-9.]/g, "");
    const dot = clean.indexOf(".");
    if (dot !== -1) clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, "");
    clean = clean.replace(/^0+(?=\d)/, "");
    if (clean.length > 6) clean = clean.slice(0, 6);
    setDraft(clean);
    const n = parseFloat(clean);
    if (!isNaN(n) && n >= cfg.min) {
      const field = sheet.field;
      patchSet(editing.ex.id, editing.set.id, (s) => ({ ...s, [field]: Math.round(n * 10) / 10 }));
    }
  };

  const editorKey = sheet && sheet.type === "editor" ? `${sheet.exId}:${sheet.setId}:${sheet.field}` : null;
  useEffect(() => {
    if (editorKey && editing && sheet && sheet.type === "editor") {
      setDraft(String((editing.set as unknown as Record<string, number>)[sheet.field]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorKey]);

  const SECTIONS = [
    {
      key: "lift" as const,
      title: "Weightlifting",
      Icon: Dumbbell,
      stat: `${totals.vol.toLocaleString()} lb`,
      addLabel: "Add lift",
      sub: `${liftCount} lifts · lb × reps`
    },
    {
      key: "cardio" as const,
      title: "Cardio",
      Icon: Flame,
      stat: `${totals.cardioMin} min`,
      addLabel: "Add cardio",
      sub: `${cardioCount} activities · min × mi`
    }
  ];

  // ---- pieces ----

  const renderCard = (ex: WorkoutExercise) => {
    const cardio = ex.kind === "cardio";
    const inc = cardio && ex.hasInc;
    return (
      <View key={ex.id} style={{ marginBottom: 12, backgroundColor: tokens.bg.raised, borderWidth: 1, borderColor: tokens.border.default, borderRadius: radius.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 16, color: tokens.text.primary }}>
              {ex.name}
            </Text>
            <Micro style={{ marginTop: 2 }}>{ex.muscle}</Micro>
          </View>
          <Pressable accessibilityLabel={`Remove ${ex.name}`} onPress={() => removeExercise(ex.id)} hitSlop={8} style={{ padding: 6 }}>
            <Trash2 size={16} color={tokens.text.tertiary} />
          </Pressable>
        </View>

        {/* column heads */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 4 }}>
          <Micro style={{ width: 32 }}>{cardio ? "Int" : "Set"}</Micro>
          <View style={{ flex: 1, alignItems: "center" }}><Micro>{cardio ? "Min" : "Lb"}</Micro></View>
          <View style={{ flex: 1, alignItems: "center" }}><Micro>{cardio ? "Mi" : "Reps"}</Micro></View>
          {inc ? <View style={{ flex: 1, alignItems: "center" }}><Micro>Inc %</Micro></View> : null}
          <View style={{ width: 46 }} />
        </View>

        {ex.sets.map((s, i) => {
          const a = ex.kind === "cardio" ? (s as CardioSet).min : fmtWeight((s as LiftSet).w);
          const b = ex.kind === "cardio" ? fmtMiles((s as CardioSet).mi, true) : (s as LiftSet).r;
          const valColor = s.done ? tokens.text.tertiary : tokens.text.primary;
          const cell = (label: React.ReactNode, field: FieldKey) => (
            <Pressable
              onPress={() => setSheet({ type: "editor", exId: ex.id, setId: s.id, field })}
              style={{ flex: 1, marginHorizontal: 4, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: tokens.bg.subtle, alignItems: "center" }}
            >
              <Text style={{ fontFamily: NUM, fontSize: inc ? 18 : 20, color: valColor }}>{label}</Text>
            </Pressable>
          );
          return (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 4,
                borderTopWidth: 1,
                borderTopColor: tokens.border.default,
                backgroundColor: s.done ? tokens.accent.goldSubtle : "transparent"
              }}
            >
              <Text style={{ width: 32, fontFamily: NUM, fontSize: 15, color: tokens.text.tertiary }}>{i + 1}</Text>
              {cell(cardio ? (s as CardioSet).min : a, cardio ? "min" : "w")}
              {cell(cardio ? fmtMiles((s as CardioSet).mi, true) : b, cardio ? "mi" : "r")}
              {inc ? cell(fmtMiles((s as CardioSet).inc ?? 0, false), "inc") : null}
              <View style={{ width: 46, alignItems: "flex-end" }}>
                <Pressable
                  accessibilityLabel={s.done ? "Unlog set" : "Log set"}
                  onPress={() => toggleDone(ex.id, s.id)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: s.done ? tokens.accent.gold : "transparent",
                    borderWidth: s.done ? 0 : 1.5,
                    borderColor: tokens.border.strong
                  }}
                >
                  <Check size={18} strokeWidth={3} color={s.done ? colors.black : tokens.text.tertiary} />
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => addSet(ex)}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: tokens.border.default }}
        >
          <Plus size={15} color={tokens.text.primary} />
          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: tokens.text.primary }}>
            {cardio ? "Add interval" : "Add set"}
          </Text>
        </Pressable>
      </View>
    );
  };

  const typeTile = (def: (typeof SECTIONS)[number], big: boolean) => {
    const Icon = def.Icon;
    return (
      <Pressable
        key={def.key}
        onPress={() => openPicker(def.key)}
        style={{
          flex: 1,
          overflow: "hidden",
          alignItems: "center",
          paddingVertical: big ? 22 : 18,
          paddingHorizontal: 12,
          backgroundColor: tokens.bg.raised,
          borderWidth: 1,
          borderColor: tokens.border.default,
          borderRadius: radius.lg
        }}
      >
        <View
          style={{
            width: big ? 52 : 46,
            height: big ? 52 : 46,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: tokens.accent.gold,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Icon size={big ? 22 : 19} color={tokens.accent.gold} strokeWidth={1.9} />
        </View>
        <Text style={{ marginTop: 12, fontFamily: DISP, fontSize: big ? 18 : 16, color: tokens.text.primary }}>{def.title}</Text>
        <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.secondary }}>{def.sub}</Text>
      </Pressable>
    );
  };

  // ---- UI ----

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.base, paddingTop: insets.top }}>
      {/* header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={{ padding: 4, marginLeft: -4 }}>
          <ChevronLeft size={24} color={tokens.text.secondary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="Workout name"
            style={{ fontFamily: DISP, fontSize: 22, color: tokens.text.primary, padding: 0 }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <PulseDot />
            <Micro style={{ color: tokens.text.secondary }}>Live</Micro>
            <Micro>· {fmtClock(elapsed)}</Micro>
          </View>
        </View>
        <Text allowFontScaling={false} style={{ fontFamily: "Boldonse_400Regular", fontSize: 12, letterSpacing: 0.5, color: tokens.text.primary }}>
          SPOTTED
        </Text>
      </View>

      {/* scroll */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {exercises.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <Text style={{ fontFamily: DISP, fontSize: 26, lineHeight: 32, color: tokens.text.primary, textAlign: "center" }}>
              Hit a lift to{"\n"}start today's log.
            </Text>
            <Text style={{ marginTop: 12, fontSize: 14, color: tokens.text.secondary, textAlign: "center" }}>
              Lifts log in sets. Cardio logs in intervals.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 28, alignSelf: "stretch" }}>
              {SECTIONS.map((def) => typeTile(def, true))}
            </View>
          </View>
        ) : (
          SECTIONS.map((def) => {
            const items = exercises.filter((x) => x.kind === def.key);
            const isCollapsed = collapsed[def.key];
            const Icon = def.Icon;
            return (
              <View key={def.key} style={{ marginBottom: 20 }}>
                <Pressable
                  onPress={() => items.length && setCollapsed((c) => ({ ...c, [def.key]: !c[def.key] }))}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingBottom: 8 }}
                >
                  <Icon size={15} color={tokens.text.primary} strokeWidth={1.9} />
                  <Text style={{ fontFamily: DISP, fontSize: 16, color: tokens.text.primary }}>{def.title}</Text>
                  <View style={{ flex: 1 }} />
                  {items.length > 0 ? (
                    <>
                      <Micro>{def.stat}</Micro>
                      {isCollapsed ? <ChevronDown size={15} color={tokens.text.tertiary} /> : <ChevronUp size={15} color={tokens.text.tertiary} />}
                    </>
                  ) : null}
                </Pressable>

                {!isCollapsed ? items.map(renderCard) : null}

                {!isCollapsed ? (
                  <Pressable
                    onPress={() => openPicker(def.key)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: tokens.border.strong, borderStyle: "dashed" }}
                  >
                    <Plus size={15} color={tokens.text.secondary} />
                    <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: tokens.text.secondary }}>{def.addLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* rest pill */}
      {rest && !finished ? (
        <Pressable
          onPress={() => setRest(null)}
          style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 96, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: tokens.bg.raised, borderWidth: 1, borderColor: tokens.border.default }}
        >
          <Micro style={{ color: tokens.text.secondary }}>Rest</Micro>
          <View style={{ flex: 1, height: 4, borderRadius: radius.pill, overflow: "hidden", backgroundColor: tokens.bg.subtle }}>
            <View style={{ height: 4, borderRadius: radius.pill, width: `${(rest.left / rest.total) * 100}%`, backgroundColor: tokens.accent.gold }} />
          </View>
          <Text style={{ fontFamily: NUM, fontSize: 16, color: tokens.text.primary }}>{fmtClock(rest.left)}</Text>
          <Micro>Skip</Micro>
        </Pressable>
      ) : null}

      {/* bottom bar */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom > 0 ? insets.bottom : 16, backgroundColor: tokens.bg.base, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
        <View>
          <Text style={{ fontFamily: NUM, fontSize: 22, color: tokens.text.primary }}>{totals.vol.toLocaleString()}</Text>
          <Micro style={{ marginTop: 2 }}>Volume · lb</Micro>
        </View>
        <View>
          <Text style={{ fontFamily: NUM, fontSize: 22, color: tokens.text.primary }}>
            {totals.done}
            <Text style={{ color: tokens.text.tertiary, fontSize: 15 }}>/{totals.all}</Text>
          </Text>
          <Micro style={{ marginTop: 2 }}>Sets</Micro>
        </View>
        {totals.cardioMin > 0 ? (
          <View>
            <Text style={{ fontFamily: NUM, fontSize: 22, color: tokens.text.primary }}>{totals.cardioMin}</Text>
            <Micro style={{ marginTop: 2 }}>Cardio</Micro>
          </View>
        ) : null}
        <Pressable
          onPress={() => void finishWorkout()}
          disabled={totals.done === 0 || saving}
          style={{ flex: 1, paddingVertical: 14, borderRadius: radius.pill, backgroundColor: tokens.text.primary, opacity: totals.done === 0 || saving ? 0.3 : 1, alignItems: "center" }}
        >
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.black }}>{saving ? "Saving…" : "Finish workout"}</Text>
        </Pressable>
      </View>

      <PickerSheet
        sheet={sheet && sheet.type === "picker" && !finished ? sheet : null}
        custom={custom}
        query={query}
        group={group}
        results={results}
        insets={insets}
        onClose={closeSheet}
        onBackToTypes={() => openPicker(null)}
        onPickType={(w) => openPicker(w)}
        onQuery={setQuery}
        onGroup={setGroup}
        onAdd={addExercise}
        onOpenCustom={openCustom}
        setCustom={setCustom}
        onCreateCustom={createCustom}
      />

      <EditorSheet
        open={Boolean(sheet && sheet.type === "editor" && editing && cfg && !finished)}
        label={cfg?.label ?? ""}
        exName={editing?.ex.name ?? ""}
        kind={editing?.ex.kind ?? "lift"}
        idx={editing?.idx ?? 0}
        draft={draft}
        chips={cfg?.chips ?? []}
        chipMode={cfg?.chipMode ?? "set"}
        step={cfg?.step ?? 1}
        insets={insets}
        onType={typeVal}
        onBump={bump}
        onChip={(c) => (cfg?.chipMode === "bump" ? bump(c) : applyVal(c))}
        onDone={() => setSheet(null)}
        onRemove={() => editing && removeSet(editing.ex.id, editing.set.id)}
      />

      {/* finish summary */}
      {finished ? (
        <View style={{ position: "absolute", inset: 0, backgroundColor: tokens.bg.base }}>
          <ScrollView contentContainerStyle={{ paddingTop: insets.top + 40, paddingHorizontal: 24, paddingBottom: 24, alignItems: "center" }}>
            <View style={{ width: 68, height: 68, borderRadius: radius.pill, backgroundColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
              <Check size={30} strokeWidth={3} color={colors.black} />
            </View>
            <Text style={{ marginTop: 20, fontFamily: DISP, fontSize: 26, lineHeight: 30, color: tokens.text.primary, textAlign: "center" }}>
              {name.trim() || "Workout"} logged.
            </Text>
            <Micro style={{ marginTop: 8 }}>
              {fmtClock(finished.dur)} · {finished.exCount} exercises
            </Micro>

            <Text style={{ marginTop: 32, fontFamily: NUM, fontSize: 56, color: tokens.text.primary }}>
              {(finished.vol > 0 ? finished.vol : finished.cardioMin).toLocaleString()}
            </Text>
            <Micro style={{ marginTop: 4 }}>{finished.vol > 0 ? "Total volume · lb" : "Cardio · min"}</Micro>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 32, marginTop: 28 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: NUM, fontSize: 26, color: tokens.text.primary }}>{finished.sets}</Text>
                <Micro style={{ marginTop: 2 }}>Sets</Micro>
              </View>
              {finished.vol > 0 && finished.cardioMin > 0 ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontFamily: NUM, fontSize: 26, color: tokens.text.primary }}>{finished.cardioMin}</Text>
                  <Micro style={{ marginTop: 2 }}>Cardio · min</Micro>
                </View>
              ) : null}
            </View>

            {celebrations.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 32 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: tokens.accent.goldSubtle, borderWidth: 1, borderColor: tokens.accent.gold }}>
                  <Trophy size={14} color={tokens.accent.gold} strokeWidth={1.9} />
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: tokens.text.primary }}>
                    {celebrations.length} new {celebrations.length > 1 ? "trophies" : "trophy"}
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}>
            <Pressable
              onPress={() => router.replace("/camera")}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: radius.pill, backgroundColor: tokens.text.primary }}
            >
              <Camera size={17} color={colors.black} />
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.black }}>Post today's SPOTTED</Text>
            </Pressable>
            <Pressable onPress={resetWorkout} style={{ marginTop: 10, paddingVertical: 14, borderRadius: radius.pill, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default, alignItems: "center" }}>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: tokens.text.primary }}>Done</Text>
            </Pressable>
          </View>

          {/* trophy unlock stack, over the summary */}
          <TrophyUnlockModal
            data={celebrateIdx < celebrations.length ? celebrations[celebrateIdx] : null}
            visible={celebrateIdx < celebrations.length}
            onClose={() => setCelebrateIdx((i) => i + 1)}
          />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------ picker sheet ------------------------------ */

function PickerSheet({
  sheet,
  custom,
  query,
  group,
  results,
  insets,
  onClose,
  onBackToTypes,
  onPickType,
  onQuery,
  onGroup,
  onAdd,
  onOpenCustom,
  setCustom,
  onCreateCustom
}: {
  sheet: { type: "picker"; mode: "types" } | { type: "picker"; mode: "list"; wtype: "lift" | "cardio" } | null;
  custom: CustomState;
  query: string;
  group: string;
  results: LibraryItem[];
  insets: { bottom: number };
  onClose: () => void;
  onBackToTypes: () => void;
  onPickType: (w: "lift" | "cardio") => void;
  onQuery: (q: string) => void;
  onGroup: (g: string) => void;
  onAdd: (item: LibraryItem) => void;
  onOpenCustom: () => void;
  setCustom: (fn: (c: CustomState) => CustomState) => void;
  onCreateCustom: () => void;
}) {
  const list = sheet && sheet.mode === "list" ? sheet : null;
  const grouped = list && list.wtype === "lift" && group === "All" && !query.trim();

  return (
    <Modal visible={Boolean(sheet)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)" }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ marginTop: "auto", maxHeight: "88%", backgroundColor: tokens.bg.raised, borderTopWidth: 1, borderColor: tokens.border.default, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}
        >
          <View style={{ alignSelf: "center", marginTop: 10, width: 36, height: 4, borderRadius: radius.pill, backgroundColor: tokens.border.strong }} />

          {/* type chooser */}
          {sheet && sheet.mode === "types" && !custom ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
              <Text style={{ fontFamily: DISP, fontSize: 19, color: tokens.text.primary }}>Add exercise</Text>
              <Micro style={{ marginTop: 4 }}>Choose a section</Micro>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <TypeTileMini title="Weightlifting" Icon={Dumbbell} onPress={() => onPickType("lift")} />
                <TypeTileMini title="Cardio" Icon={Flame} onPress={() => onPickType("cardio")} />
              </View>
            </View>
          ) : null}

          {/* list */}
          {list && !custom ? (
            <View style={{ flex: 1 }}>
              <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable accessibilityLabel="Back to sections" onPress={onBackToTypes} hitSlop={8} style={{ padding: 4, marginLeft: -4 }}>
                    <ArrowLeft size={18} color={tokens.text.secondary} />
                  </Pressable>
                  {list.wtype === "cardio" ? <Flame size={16} color={tokens.text.primary} strokeWidth={1.9} /> : <Dumbbell size={16} color={tokens.text.primary} strokeWidth={1.9} />}
                  <Text style={{ flex: 1, fontFamily: DISP, fontSize: 19, color: tokens.text.primary }}>
                    {list.wtype === "cardio" ? "Cardio" : "Weightlifting"}
                  </Text>
                  <Pressable onPress={onOpenCustom} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: tokens.text.primary }}>
                    <Plus size={13} strokeWidth={3} color={colors.black} />
                    <Text style={{ fontFamily: "Geist_700Bold", fontSize: 12, color: colors.black }}>Custom</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default }}>
                  <Search size={16} color={tokens.text.tertiary} />
                  <TextInput
                    autoFocus
                    value={query}
                    onChangeText={onQuery}
                    placeholder={list.wtype === "cardio" ? "Search cardio" : "Search lifts"}
                    placeholderTextColor={tokens.text.tertiary}
                    style={{ flex: 1, fontSize: 14, color: tokens.text.primary, padding: 0 }}
                  />
                  {query ? (
                    <Pressable accessibilityLabel="Clear search" onPress={() => onQuery("")} hitSlop={8}>
                      <X size={15} color={tokens.text.tertiary} />
                    </Pressable>
                  ) : null}
                </View>
                {list.wtype === "lift" && !query ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
                    {["All", ...LIFT_MUSCLES].map((m) => {
                      const sel = group === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => onGroup(m)}
                          style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: sel ? tokens.text.primary : tokens.bg.subtle, borderWidth: 1, borderColor: sel ? tokens.text.primary : tokens.border.default }}
                        >
                          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: sel ? colors.black : tokens.text.secondary }}>{m}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 28 }}>
                {grouped ? (
                  LIFT_MUSCLES.map((m) => {
                    const items = results.filter((l) => l.muscle === m);
                    if (!items.length) return null;
                    return (
                      <View key={m} style={{ marginBottom: 16 }}>
                        <Micro style={{ marginBottom: 6 }}>{m}</Micro>
                        {items.map((item) => (
                          <ExerciseRow key={item.name} item={item} showMuscle={false} onPress={() => onAdd(item)} />
                        ))}
                      </View>
                    );
                  })
                ) : (
                  results.map((item) => (
                    <ExerciseRow key={item.name} item={item} showMuscle={list.wtype === "lift"} onPress={() => onAdd(item)} />
                  ))
                )}
                {results.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <Text style={{ fontSize: 14, color: tokens.text.secondary, textAlign: "center" }}>
                      &quot;{query}&quot; isn&apos;t in the library yet.
                    </Text>
                    <Pressable onPress={onOpenCustom} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: tokens.text.primary }}>
                      <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Create &quot;{query.trim()}&quot;</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {/* custom form */}
          {custom ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
              <Pressable onPress={() => setCustom(() => null)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <ArrowLeft size={14} color={tokens.text.secondary} />
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: tokens.text.secondary }}>Back to library</Text>
              </Pressable>
              <Text style={{ fontFamily: DISP, fontSize: 19, color: tokens.text.primary }}>Custom exercise</Text>

              <Micro style={{ marginTop: 16, marginBottom: 6 }}>Name</Micro>
              <TextInput
                autoFocus
                value={custom.name}
                onChangeText={(t) => setCustom((c) => (c ? { ...c, name: t } : c))}
                placeholder="e.g. Zercher Squat"
                placeholderTextColor={tokens.text.tertiary}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default, fontSize: 14, color: tokens.text.primary }}
              />

              <Micro style={{ marginTop: 16, marginBottom: 6 }}>Category</Micro>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {MUSCLES.map((m) => {
                  const sel = custom.muscle === m;
                  return (
                    <Pressable key={m} onPress={() => setCustom((c) => (c ? { ...c, muscle: m } : c))} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: sel ? tokens.text.primary : tokens.bg.subtle, borderWidth: 1, borderColor: sel ? tokens.text.primary : tokens.border.default }}>
                      <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: sel ? colors.black : tokens.text.secondary }}>{m}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {custom.muscle === "Cardio" ? (
                <>
                  <Micro style={{ marginTop: 16, marginBottom: 6 }}>Incline</Micro>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[{ v: false, l: "Off" }, { v: true, l: "On — track incline %" }].map((o) => {
                      const sel = custom.inc === o.v;
                      return (
                        <Pressable key={o.l} onPress={() => setCustom((c) => (c ? { ...c, inc: o.v } : c))} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: sel ? tokens.text.primary : tokens.bg.subtle, borderWidth: 1, borderColor: sel ? tokens.text.primary : tokens.border.default }}>
                          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: sel ? colors.black : tokens.text.secondary }}>{o.l}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Pressable onPress={onCreateCustom} disabled={!custom.name.trim()} style={{ marginTop: 24, paddingVertical: 14, borderRadius: radius.pill, backgroundColor: tokens.text.primary, opacity: custom.name.trim() ? 1 : 0.3, alignItems: "center" }}>
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Add to workout</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TypeTileMini({ title, Icon, onPress }: { title: string; Icon: typeof Dumbbell; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", paddingVertical: 18, paddingHorizontal: 12, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default, borderRadius: radius.lg }}>
      <View style={{ width: 46, height: 46, borderRadius: radius.pill, borderWidth: 1.5, borderColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} color={tokens.accent.gold} strokeWidth={1.9} />
      </View>
      <Text style={{ marginTop: 12, fontFamily: DISP, fontSize: 16, color: tokens.text.primary }}>{title}</Text>
    </Pressable>
  );
}

function ExerciseRow({ item, showMuscle, onPress }: { item: LibraryItem; showMuscle: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
      <Text style={{ flex: 1, fontFamily: "Geist_500Medium", fontSize: 15, color: tokens.text.primary }}>
        {item.name}
        {item.custom ? <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 10, color: tokens.text.tertiary }}>  Custom</Text> : null}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {showMuscle ? <Micro>{item.muscle}</Micro> : null}
        <Plus size={16} color={tokens.text.primary} />
      </View>
    </Pressable>
  );
}

/* ------------------------------ editor sheet ------------------------------ */

function EditorSheet({
  open,
  label,
  exName,
  kind,
  idx,
  draft,
  chips,
  chipMode,
  step,
  insets,
  onType,
  onBump,
  onChip,
  onDone,
  onRemove
}: {
  open: boolean;
  label: string;
  exName: string;
  kind: "lift" | "cardio";
  idx: number;
  draft: string;
  chips: number[];
  chipMode: "bump" | "set";
  step: number;
  insets: { bottom: number };
  onType: (raw: string) => void;
  onBump: (delta: number) => void;
  onChip: (c: number) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)" }} onPress={onDone}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ marginTop: "auto", backgroundColor: tokens.bg.raised, borderTopWidth: 1, borderColor: tokens.border.default, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}>
          <View style={{ alignSelf: "center", marginTop: 10, width: 36, height: 4, borderRadius: radius.pill, backgroundColor: tokens.border.strong }} />
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
            <Micro style={{ textAlign: "center" }}>
              {exName} · {kind === "cardio" ? "Interval" : "Set"} {idx + 1}
            </Micro>
            <TextInput
              value={draft}
              onChangeText={onType}
              keyboardType="decimal-pad"
              selectTextOnFocus
              accessibilityLabel={label}
              style={{ fontFamily: NUM, fontSize: 64, textAlign: "center", marginTop: 4, color: tokens.text.primary, padding: 0 }}
            />
            <Micro style={{ textAlign: "center", marginTop: 8 }}>{label} · tap the number to type</Micro>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32, marginTop: 20 }}>
              <Pressable accessibilityLabel="Decrease" onPress={() => onBump(-step)} style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default, alignItems: "center", justifyContent: "center" }}>
                <Minus size={22} color={tokens.text.primary} />
              </Pressable>
              <Pressable accessibilityLabel="Increase" onPress={() => onBump(step)} style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
                <Plus size={22} color={colors.black} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 20 }}>
              {chips.map((c) => (
                <Pressable key={c} onPress={() => onChip(c)} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default }}>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: tokens.text.primary }}>{chipMode === "bump" && c > 0 ? `+${c}` : c}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={onDone} style={{ marginTop: 24, paddingVertical: 14, borderRadius: radius.pill, backgroundColor: tokens.text.primary, alignItems: "center" }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Done</Text>
            </Pressable>
            <Pressable onPress={onRemove} style={{ marginTop: 8, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: DANGER }}>Remove {kind === "cardio" ? "interval" : "set"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
