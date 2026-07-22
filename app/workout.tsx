import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Minus,
  Pencil,
  Plus,
  Search,
  Trophy,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dismissKeyboardFromPress } from "@/components/ui/DismissKeyboard";
import { Confetti } from "@/components/workout/Confetti";
import { TrophyUnlockModal } from "@/components/trophies/TrophyUnlockModal";
import type { TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { useUserLifts } from "@/hooks/queries/useUserLifts";
import {
  deriveExerciseBests,
  isRepsGraded,
  useAttachWorkoutToDaily,
  useRenameWorkout,
  useSaveWorkout,
  useTodayDailyPost,
  useWorkouts,
  type CardioSet,
  type LiftSet,
  type SessionPR,
  type WorkoutExercise
} from "@/hooks/queries/useWorkouts";
import { impactHaptic, successHaptic } from "@/lib/haptics";
import { fuzzyFilter, LIFT_ALIASES } from "@/lib/searchMatch";
import { BASE_LIBRARY, fmtClock, isCardioItem, LIFT_MUSCLES, sessionTitle, type LibraryItem } from "@/lib/workoutLibrary";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const DISP = "Geist_700Bold";
const NUM = "GeistMono_500Medium";
/** Cardio accent (prototype #ff8a4c) — lifts stay on the app gold. */
const CARDIO = "#FF8A4C";
const CARDIO_TINT = "rgba(255,138,76,0.14)";

let _id = Date.now() % 10_000_000;
const uid = () => ++_id;

/** Drag-down-to-dismiss grip for the picker/logger modal sheets. */
function SheetGrip({ onDismiss }: { onDismiss: () => void }) {
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 60 || g.vy > 0.5) onDismiss();
      }
    })
  ).current;
  return (
    <View {...responder.panHandlers} style={{ alignSelf: "stretch", alignItems: "center", paddingTop: 14, paddingBottom: 10 }}>
      <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: tokens.border.strong }} />
    </View>
  );
}

/** The blinking LIVE dot (prototype `blink`). */
function BlinkDot({ size = 9 }: { size?: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.accent.gold }, style]}
    />
  );
}

/** Tiny letterspaced caps label. */
function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        { fontFamily: "Geist_600SemiBold", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: tokens.text.tertiary },
        style
      ]}
    >
      {children}
    </Text>
  );
}

function PrBadge({ label = "PR" }: { label?: string }) {
  return (
    <View style={{ backgroundColor: tokens.accent.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontFamily: DISP, fontSize: 10, letterSpacing: 1, color: colors.black }}>{label}</Text>
    </View>
  );
}

type Celebration = { text: string };

type Summary = {
  title: string;
  volume: number;
  sets: number;
  reps: number;
  duration: number;
  exCount: number;
  prs: SessionPR[];
  celebrations: TrophyShareData[];
};

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // daily=1 → this workout is tied to today's daily post: finishing prompts
  // the daily photo, and publishing attaches this workout as a feed slide.
  const params = useLocalSearchParams<{ daily?: string }>();
  const dailyTied = params.daily === "1";
  const userId = useAuthStore((s) => s.userId);
  const saveWorkout = useSaveWorkout();

  const session = useWorkoutSession();
  const workouts = useWorkouts(userId);
  const lifts = useUserLifts(userId);
  const todayDaily = useTodayDailyPost(userId);
  const attachToDaily = useAttachWorkoutToDaily();
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);
  // Rename on the finish screen (pencil next to the workout name).
  const renameWorkout = useRenameWorkout();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const startRename = () => {
    setNameDraft(summary?.title ?? "");
    setEditingName(true);
  };
  const commitRename = () => {
    setEditingName(false);
    const next = nameDraft.trim();
    if (!next || !summary || next === summary.title) return;
    setSummary((prev) => (prev ? { ...prev, title: next } : prev));
    if (savedWorkoutId) {
      renameWorkout.mutate({ workoutId: savedWorkoutId, name: next }, { onError: () => showToast("Couldn't rename — try again") });
    }
  };

  // Start (or resume) the session on mount. Also prune empty entries left
  // behind if the app closed mid-logger. The timer does NOT auto-start —
  // the user starts it explicitly with the Start workout button (or by
  // logging their first set).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (useWorkoutSession.getState().active) {
      // Resuming an in-progress session: drop any empty leftover entries.
      useWorkoutSession.getState().setExercises((prev) => prev.filter((ex) => ex.sets.length > 0));
    } else {
      // Fresh visit: clean slate, timer idle until Start is pressed.
      useWorkoutSession.getState().clear();
    }
  }, []);

  // Seed the PR detector with bests from history + canonical lifts.
  const derivedBests = useMemo(
    () => deriveExerciseBests(workouts.data, lifts.data),
    [workouts.data, lifts.data]
  );
  useEffect(() => {
    if (Object.keys(derivedBests).length > 0) session.seedBests(derivedBests);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedBests]);

  // Live timer.
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    if (summary) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [summary]);
  const elapsed = session.active && session.startedAt ? Math.max(0, Math.floor((nowMs - session.startedAt) / 1000)) : 0;

  // Picker + logger state (local — the entry list itself lives in the store).
  const [picker, setPicker] = useState<null | "lift" | "cardio">(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [customText, setCustomText] = useState("");
  const [customItems, setCustomItems] = useState<LibraryItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [a, setA] = useState("0");
  const [logError, setLogError] = useState<string | null>(null);
  const [b, setB] = useState("0");

  // PR celebration overlay.
  const [celebrating, setCelebrating] = useState<Celebration | null>(null);
  const [confKey, setConfKey] = useState(0);
  const celebTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (celebTimer.current) clearTimeout(celebTimer.current);
  }, []);

  // Trophy cascade + summary volume count-up.
  const [celebrateIdx, setCelebrateIdx] = useState(0);
  const [animSets, setAnimSets] = useState(0);
  const [saving, setSaving] = useState(false);

  const exercises = session.exercises;
  const active = exercises.find((e) => e.id === activeId) ?? null;
  const isLift = active ? active.kind === "lift" : picker === "lift";

  const totals = useMemo(() => {
    let vol = 0;
    let sets = 0;
    let reps = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        sets += 1;
        if (ex.kind === "lift") {
          vol += (s as LiftSet).w * (s as LiftSet).r;
          reps += (s as LiftSet).r;
        }
      }
    }
    return { vol, sets, reps };
  }, [exercises]);

  const library = useMemo(() => [...BASE_LIBRARY, ...customItems], [customItems]);
  const pickerResults = useMemo(() => {
    if (!picker) return [];
    const pool = library.filter((l) => (picker === "cardio") === isCardioItem(l));
    const q = query.trim();
    // Fuzzy, alias-aware ranking ("ohp", "bnech", "press bench" all resolve).
    if (q) return fuzzyFilter(pool, q, (l) => l.name, (l) => LIFT_ALIASES[l.name]);
    if (picker === "lift" && group !== "All") return pool.filter((l) => l.muscle === group);
    return pool;
  }, [picker, query, group, library]);

  const suggestWeight = (name: string, fallback: number) => {
    const best = session.bests[name] ?? 0;
    if (best > 0 && !isRepsGraded(name)) return Math.max(45, Math.round((best * 0.75) / 5) * 5);
    return fallback;
  };

  const openLogger = (entry: WorkoutExercise) => {
    if (entry.kind === "lift") {
      setA(String(suggestWeight(entry.name, entry.defW)));
      setB(String(entry.defR || 8));
    } else {
      setA(String(entry.defMi || 2));
      setB(String(entry.defMin || 12));
    }
    setActiveId(entry.id);
    setPicker(null);
  };

  const pick = (item: LibraryItem) => {
    const kind = isCardioItem(item) ? "cardio" : "lift";
    const existing = exercises.find((e) => e.name === item.name && e.kind === kind);
    if (existing) {
      openLogger(existing);
      return;
    }
    const entry: WorkoutExercise =
      kind === "cardio"
        ? {
            id: uid(),
            name: item.name,
            muscle: item.muscle,
            kind: "cardio",
            defMin: item.min ?? 20,
            defMi: item.mi ?? 0,
            hasInc: item.inc !== undefined,
            defInc: item.inc,
            sets: []
          }
        : { id: uid(), name: item.name, muscle: item.muscle, kind: "lift", defW: item.w ?? 45, defR: item.r ?? 10, sets: [] };
    session.setExercises((prev) => [...prev, entry]);
    openLogger(entry);
  };

  const addCustom = () => {
    const name = customText.trim();
    if (!name) return;
    const item: LibraryItem =
      picker === "cardio"
        ? { name, muscle: "Cardio", min: 20, mi: 2, custom: true }
        : { name, muscle: "Full Body", w: 45, r: 10, custom: true };
    setCustomItems((prev) => (prev.some((c) => c.name === name) ? prev : [...prev, item]));
    setCustomText("");
    pick(item);
  };

  const sanitizeDec = (v: string) => {
    const clean = v.replace(/[^0-9.]/g, "");
    const dot = clean.indexOf(".");
    return dot === -1 ? clean : clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, "");
  };

  const step = (setter: (fn: (v: string) => string) => void, delta: number) =>
    setter((v) => {
      let n = (parseFloat(v) || 0) + delta;
      n = Math.round(n * 100) / 100;
      return String(Math.max(0, n));
    });

  const closeLogger = () => {
    const entry = active;
    if (entry && entry.sets.length === 0) {
      session.setExercises((prev) => prev.filter((e) => e.id !== entry.id));
    }
    setActiveId(null);
  };

  /** Start the clock, keeping anything the user set up before pressing Start. */
  const startSession = () => {
    const state = useWorkoutSession.getState();
    if (state.active) return;
    const kept = state.exercises;
    state.start();
    if (kept.length > 0) state.setExercises(() => kept);
    state.seedBests(derivedBests);
  };

  const logSet = () => {
    const entry = active;
    if (!entry) return;
    let isPR = false;
    let prInfo: SessionPR | null = null;
    let newBest = 0;

    if (entry.kind === "lift") {
      const w = parseFloat(a) || 0;
      const r = parseInt(b, 10) || 0;
      // Hard caps (Trophy v2 spec A) — reject out of range, never clamp
      // (clamping creates phantom PRs). Reps 1–200, weight 0–999 (0 = bodyweight).
      if (r < 1 || r > 200) {
        setLogError("Reps must be 1–200");
        return;
      }
      if (w < 0 || w > 999) {
        setLogError("Weight must be 0–999 lb");
        return;
      }
      setLogError(null);
      // Logging starts the clock implicitly (past validation now).
      startSession();
      const repsGraded = isRepsGraded(entry.name);
      const metric = repsGraded ? r : w;
      const cur = useWorkoutSession.getState().bests[entry.name] ?? 0;
      if (metric > cur && metric > 0) {
        isPR = true;
        newBest = metric;
        prInfo = {
          name: entry.name,
          value: repsGraded ? `${r} reps` : `${w} lb`,
          was: cur > 0 ? (repsGraded ? `was ${cur} reps` : `was ${cur} lb`) : "first log"
        };
      }
      const set: LiftSet = { id: uid(), w, r, done: true, ...(isPR ? { pr: true } : {}) };
      session.setExercises((prev) =>
        prev.map((e) => (e.id === entry.id ? ({ ...e, sets: [...e.sets, set] } as WorkoutExercise) : e))
      );
    } else {
      const mi = parseFloat(a) || 0;
      const min = parseInt(b, 10) || 0;
      if (min < 1 || min > 600) {
        setLogError("Minutes must be 1–600");
        return;
      }
      setLogError(null);
      startSession();
      const cur = useWorkoutSession.getState().bests[entry.name] ?? 0;
      if (mi > cur && mi > 0) {
        isPR = true;
        newBest = mi;
        prInfo = { name: entry.name, value: `${mi} mi`, was: cur > 0 ? `was ${cur} mi` : "first log" };
      }
      const set: CardioSet = { id: uid(), min, mi, done: true, ...(isPR ? { pr: true } : {}) };
      session.setExercises((prev) =>
        prev.map((e) => (e.id === entry.id ? ({ ...e, sets: [...e.sets, set] } as WorkoutExercise) : e))
      );
    }

    if (isPR && prInfo) {
      session.recordPR(prInfo, entry.name, newBest);
      setCelebrating({ text: `${entry.name} · ${prInfo.value}` });
      setConfKey((k) => k + 1);
      if (celebTimer.current) clearTimeout(celebTimer.current);
      celebTimer.current = setTimeout(() => setCelebrating(null), 1600);
      void successHaptic();
    } else {
      void impactHaptic();
    }
  };

  const finish = async () => {
    if (totals.sets === 0 || !userId || saving) return;
    setSaving(true);
    const hasLift = exercises.some((e) => e.kind === "lift" && e.sets.length > 0);
    const hasCardio = exercises.some((e) => e.kind === "cardio" && e.sets.length > 0);
    const title = sessionTitle(hasLift, hasCardio);
    const logged = exercises.filter((e) => e.sets.length > 0);
    try {
      const result = await saveWorkout.mutateAsync({
        userId,
        name: title,
        startedAt: session.startedAt,
        durationSeconds: elapsed,
        exercises: logged,
        sessionPRs: session.sessionPRs
      });
      setSavedWorkoutId(result.workoutId);
      setSummary({
        title,
        volume: totals.vol,
        sets: totals.sets,
        reps: totals.reps,
        duration: elapsed,
        exCount: logged.length,
        prs: session.sessionPRs,
        celebrations: result.celebrations
      });
      setCelebrateIdx(0);
      setConfKey((k) => k + 1);
      setActiveId(null);
      setPicker(null);
    } catch {
      showToast("Couldn't save your workout — check your connection");
    } finally {
      setSaving(false);
    }
  };

  // Summary sets count-up (cubic ease-out over 900ms) — volume is no longer
  // surfaced anywhere; sets are the headline stat.
  useEffect(() => {
    if (!summary) return;
    const target = summary.sets;
    if (target <= 0) {
      setAnimSets(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimSets(Math.round(target * eased));
      if (p >= 1) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [summary]);

  const done = () => {
    session.clear();
    router.back();
  };

  /* ------------------------------- pieces -------------------------------- */

  const entrySummary = (e: WorkoutExercise) => {
    if (e.sets.length === 0) return "No sets yet";
    if (e.kind === "lift") {
      const best = Math.max(...e.sets.map((s) => (s as LiftSet).w));
      return `${e.sets.length} ${e.sets.length === 1 ? "set" : "sets"} · top ${best} lb`;
    }
    const min = e.sets.reduce((acc, s) => acc + (s as CardioSet).min, 0);
    return `${e.sets.length} ${e.sets.length === 1 ? "interval" : "intervals"} · ${min} min`;
  };

  const entryMetric = (e: WorkoutExercise) => {
    if (e.kind === "lift") {
      return e.sets.reduce((acc, s) => acc + (s as LiftSet).w * (s as LiftSet).r, 0).toLocaleString();
    }
    return e.sets.reduce((acc, s) => acc + (s as CardioSet).mi, 0).toFixed(1);
  };

  const setRow = (e: WorkoutExercise, s: LiftSet | CardioSet, i: number) => {
    const pr = Boolean(s.pr);
    const text =
      e.kind === "lift"
        ? `${(s as LiftSet).w} lb × ${(s as LiftSet).r}`
        : `${(s as CardioSet).mi} mi · ${(s as CardioSet).min} min`;
    const sub =
      e.kind === "lift"
        ? `${(s as LiftSet).w * (s as LiftSet).r} lb`
        : `${(s as CardioSet).mi > 0 ? ((s as CardioSet).min / (s as CardioSet).mi).toFixed(1) : "0"} min/mi`;
    return (
      <View
        key={s.id}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: pr ? tokens.accent.goldSubtle : tokens.bg.subtle,
          borderWidth: 1,
          borderColor: pr ? "rgba(232,180,76,0.4)" : tokens.border.default,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 15
        }}
      >
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: tokens.bg.base, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: NUM, fontSize: 13, color: tokens.text.secondary }}>{i + 1}</Text>
        </View>
        <Text style={{ flex: 1, fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.text.primary }}>{text}</Text>
        {pr ? <PrBadge /> : null}
        <Text style={{ fontFamily: NUM, fontSize: 13, color: tokens.text.tertiary }}>{sub}</Text>
      </View>
    );
  };

  const categoryCard = (kind: "lift" | "cardio") => {
    const Icon = kind === "lift" ? Dumbbell : Flame;
    return (
      <Pressable
        key={kind}
        onPress={() => {
          setPicker(kind);
          setQuery("");
          setGroup("All");
          setCustomText("");
        }}
        style={{
          flex: 1,
          gap: 12,
          borderWidth: 1,
          borderColor: tokens.border.default,
          backgroundColor: tokens.bg.raised,
          borderRadius: radius.lg,
          paddingVertical: 20,
          paddingHorizontal: 18
        }}
      >
        <View style={{ width: 52, height: 52, borderRadius: radius.pill, borderWidth: 2, borderColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
          <Icon size={kind === "lift" ? 26 : 24} color={tokens.accent.gold} strokeWidth={1.7} />
        </View>
        <View>
          <Text style={{ fontFamily: DISP, fontSize: 19, color: tokens.text.primary }}>
            {kind === "lift" ? "Weightlifting" : "Cardio"}
          </Text>
          <Text style={{ marginTop: 3, fontSize: 13, color: tokens.text.tertiary }}>
            {kind === "lift"
              ? `${library.filter((l) => !isCardioItem(l)).length} lifts · lb × reps`
              : `${library.filter(isCardioItem).length} activities · min × mi`}
          </Text>
        </View>
      </Pressable>
    );
  };

  /* -------------------------------- render ------------------------------- */

  if (summary) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LinearGradient
          colors={["#1C1608", colors.black]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
        />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
          <View style={{ paddingHorizontal: 26, alignItems: "center" }}>
            <Micro style={{ color: tokens.accent.gold, letterSpacing: 3 }}>Workout complete</Micro>
            <Text style={{ marginTop: 10, fontFamily: DISP, fontSize: 32, lineHeight: 36, color: tokens.text.primary, textAlign: "center" }}>
              {summary.prs.length > 0
                ? `${summary.prs.length} personal ${summary.prs.length === 1 ? "record" : "records"} smashed.`
                : "Solid session logged."}
            </Text>
            {/* Workout name — defaults to the session type, pencil to rename. */}
            {editingName ? (
              <TextInput
                autoFocus
                value={nameDraft}
                onChangeText={setNameDraft}
                onSubmitEditing={commitRename}
                onBlur={commitRename}
                maxLength={60}
                style={{ marginTop: 10, minWidth: 180, textAlign: "center", fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.text.primary, borderBottomWidth: 1, borderBottomColor: tokens.accent.gold, paddingVertical: 4 }}
              />
            ) : (
              <Pressable
                onPress={startRename}
                accessibilityLabel="Rename workout"
                style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.text.secondary }}>
                  {summary.title}
                </Text>
                <Pencil size={14} color={tokens.text.tertiary} strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {summary.prs.length > 0 ? (
            <View style={{ paddingHorizontal: 26, paddingTop: 30, gap: 12 }}>
              {summary.prs.map((pr) => (
                <View
                  key={pr.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    borderWidth: 1,
                    borderColor: "rgba(232,180,76,0.35)",
                    backgroundColor: tokens.accent.goldSubtle,
                    borderRadius: radius.lg,
                    paddingVertical: 16,
                    paddingHorizontal: 18
                  }}
                >
                  <Trophy size={38} color={tokens.accent.gold} strokeWidth={1.6} />
                  <View style={{ flex: 1 }}>
                    <Micro style={{ color: tokens.accent.gold }}>New PR</Micro>
                    <Text style={{ marginTop: 1, fontFamily: DISP, fontSize: 18, color: tokens.text.primary }}>{pr.name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: NUM, fontSize: 20, color: tokens.text.primary }}>{pr.value}</Text>
                    <Text style={{ fontSize: 11, color: "#9A8A5A" }}>{pr.was}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 26, paddingTop: 26, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {[
              { v: `${animSets}`, l: "Sets" },
              { v: `${summary.reps}`, l: "Reps" },
              { v: fmtClock(summary.duration), l: "Duration" },
              { v: `${summary.exCount}`, l: "Exercises" }
            ].map((st) => (
              <View
                key={st.l}
                style={{
                  width: "48%",
                  flexGrow: 1,
                  borderWidth: 1,
                  borderColor: tokens.border.default,
                  backgroundColor: tokens.bg.raised,
                  borderRadius: radius.lg,
                  padding: 20
                }}
              >
                <Text style={{ fontFamily: NUM, fontSize: 32, lineHeight: 34, color: tokens.text.primary }}>{st.v}</Text>
                <Micro style={{ marginTop: 6 }}>{st.l}</Micro>
              </View>
            ))}
          </View>

          <View style={{ marginTop: "auto", paddingHorizontal: 26, paddingTop: 24 }}>
            {dailyTied || !todayDaily.data ? (
              // Workout-first daily (or no daily yet today): finishing prompts the
              // daily photo; publishing attaches this workout as slide 2.
              <>
                <Pressable
                  onPress={() => {
                    session.clear();
                    const suffix = savedWorkoutId ? `&workout=${savedWorkoutId}` : "";
                    router.replace(`/camera?mode=daily${suffix}` as never);
                  }}
                  style={{ paddingVertical: 19, borderRadius: radius.pill, backgroundColor: tokens.accent.gold, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
                >
                  <Camera size={18} color={colors.black} />
                  <Text style={{ fontFamily: DISP, fontSize: 17, color: colors.black }}>Take your daily photo</Text>
                </Pressable>
                <Pressable onPress={done} style={{ marginTop: 10, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border.strong, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: tokens.text.primary }}>Not now</Text>
                </Pressable>
              </>
            ) : (
              // Second workout of the day — the daily is already posted. Offer to
              // append this workout to it (notifies friends).
              <>
                <Pressable
                  onPress={() => {
                    if (attached || !savedWorkoutId || !todayDaily.data) return;
                    attachToDaily.mutate(
                      { workoutId: savedWorkoutId, postId: todayDaily.data, workoutName: summary.title },
                      {
                        onSuccess: () => {
                          setAttached(true);
                          showToast("Added to today's post — your crew's been notified");
                        },
                        onError: () => showToast("Couldn't add it — try again")
                      }
                    );
                  }}
                  disabled={attached || attachToDaily.isPending}
                  style={{ paddingVertical: 19, borderRadius: radius.pill, backgroundColor: attached ? tokens.bg.subtle : tokens.accent.gold, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
                >
                  <Plus size={18} color={attached ? tokens.text.tertiary : colors.black} />
                  <Text style={{ fontFamily: DISP, fontSize: 17, color: attached ? tokens.text.tertiary : colors.black }}>
                    {attached ? "Added to today's post" : "Add to today's daily post"}
                  </Text>
                </Pressable>
                <Pressable onPress={done} style={{ marginTop: 10, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border.strong, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: tokens.text.primary }}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>

        <Confetti seed={confKey} />
        <TrophyUnlockModal
          data={celebrateIdx < summary.celebrations.length ? summary.celebrations[celebrateIdx] : null}
          visible={celebrateIdx < summary.celebrations.length}
          onClose={() => setCelebrateIdx((i) => i + 1)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.base }}>
      {/* header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityLabel="Back to My Workouts" onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 2 }}>
            <ChevronLeft size={28} color={tokens.text.secondary} />
          </Pressable>
          <Text style={{ fontFamily: DISP, fontSize: 28, letterSpacing: -0.6, color: tokens.text.primary }}>Workout</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingLeft: 36, marginTop: 6 }}>
          {session.active ? (
            <>
              <BlinkDot />
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, letterSpacing: 1.5, color: tokens.text.secondary }}>
                LIVE · <Text style={{ fontFamily: NUM, color: tokens.text.primary }}>{fmtClock(elapsed)}</Text>
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, letterSpacing: 1.5, color: tokens.text.tertiary }}>
              READY · hit Start to run the clock
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {categoryCard("lift")}
          {categoryCard("cardio")}
        </View>

        {exercises.length === 0 ? (
          <View style={{ paddingTop: 46, paddingHorizontal: 10, alignItems: "center" }}>
            <Text style={{ fontFamily: DISP, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: tokens.text.primary, textAlign: "center" }}>
              Hit a lift to{"\n"}start today&apos;s log.
            </Text>
            <Text style={{ marginTop: 16, fontSize: 15, color: tokens.text.tertiary, textAlign: "center" }}>
              Lifts log in sets. Cardio logs in intervals.
            </Text>
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 12, paddingHorizontal: 2 }}>
              <Micro style={{ letterSpacing: 3 }}>Today&apos;s log</Micro>
              <Micro style={{ color: tokens.accent.gold, letterSpacing: 1 }}>
                {totals.sets} {totals.sets === 1 ? "set" : "sets"} logged
              </Micro>
            </View>
            <View style={{ gap: 12 }}>
              {exercises.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => openLogger(e)}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.border.default,
                    backgroundColor: tokens.bg.raised,
                    borderRadius: radius.lg,
                    padding: 16
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: radius.sm,
                        backgroundColor: e.kind === "lift" ? tokens.accent.goldSubtle : CARDIO_TINT,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {e.kind === "lift" ? (
                        <Dumbbell size={20} color={tokens.accent.gold} strokeWidth={1.8} />
                      ) : (
                        <Flame size={19} color={CARDIO} strokeWidth={1.7} />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 17, color: tokens.text.primary }}>
                          {e.name}
                        </Text>
                        {e.sets.some((s) => s.pr) ? <PrBadge /> : null}
                      </View>
                      <Text style={{ marginTop: 2, fontSize: 13, color: tokens.text.tertiary }}>{entrySummary(e)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontFamily: NUM, fontSize: 18, color: tokens.text.primary }}>{entryMetric(e)}</Text>
                      <Micro style={{ marginTop: 1, letterSpacing: 0.5 }}>{e.kind === "lift" ? "lb vol" : "miles"}</Micro>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* bottom totals bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          borderTopWidth: 1,
          borderTopColor: tokens.border.default,
          backgroundColor: colors.black,
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : 22
        }}
      >
        <View>
          <Text style={{ fontFamily: NUM, fontSize: 26, lineHeight: 27, color: tokens.text.primary }}>{totals.reps}</Text>
          <Micro style={{ marginTop: 4, letterSpacing: 1.5 }}>Reps</Micro>
        </View>
        <View>
          <Text style={{ fontFamily: NUM, fontSize: 26, lineHeight: 27, color: tokens.text.primary }}>
            {totals.sets}
            <Text style={{ color: tokens.text.tertiary }}>/{exercises.length}</Text>
          </Text>
          <Micro style={{ marginTop: 4, letterSpacing: 1.5 }}>Sets</Micro>
        </View>
        {/* One button, two lives: Start workout (runs the clock) → Finish
            workout once the session is live. */}
        {session.active ? (
          <Pressable
            onPress={() => void finish()}
            disabled={totals.sets === 0 || saving}
            style={{
              marginLeft: "auto",
              paddingVertical: 16,
              paddingHorizontal: 26,
              borderRadius: radius.pill,
              backgroundColor: totals.sets > 0 ? tokens.text.primary : tokens.bg.subtle
            }}
          >
            <Text style={{ fontFamily: DISP, fontSize: 16, color: totals.sets > 0 ? colors.black : tokens.text.tertiary }}>
              {saving ? "Saving…" : "Finish workout"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              startSession();
              void impactHaptic();
            }}
            style={{
              marginLeft: "auto",
              paddingVertical: 16,
              paddingHorizontal: 26,
              borderRadius: radius.pill,
              backgroundColor: tokens.accent.gold
            }}
          >
            <Text style={{ fontFamily: DISP, fontSize: 16, color: colors.black }}>Start workout</Text>
          </Pressable>
        )}
      </View>

      {/* ---------------------------- picker sheet --------------------------- */}
      <Modal visible={Boolean(picker) && !activeId} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={() => setPicker(null)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
          <Pressable
            onPress={(e) => { e.stopPropagation(); dismissKeyboardFromPress(e); }}
            style={{
              marginTop: "auto",
              maxHeight: "82%",
              backgroundColor: tokens.bg.raised,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderTopWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              overflow: "hidden"
            }}
          >
            <SheetGrip onDismiss={() => setPicker(null)} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
                {picker === "cardio" ? <Flame size={18} color={tokens.accent.gold} strokeWidth={1.7} /> : <Dumbbell size={19} color={tokens.accent.gold} strokeWidth={1.8} />}
              </View>
              <View>
                <Text style={{ fontFamily: DISP, fontSize: 22, color: tokens.text.primary }}>
                  {picker === "cardio" ? "Cardio" : "Weightlifting"}
                </Text>
                <Text style={{ fontSize: 13, color: tokens.text.tertiary }}>
                  {picker === "cardio" ? "Pick an activity · logs in intervals" : "Pick a lift · logs in sets"}
                </Text>
              </View>
            </View>

            {/* search + muscle chips */}
            <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, backgroundColor: tokens.bg.base, borderWidth: 1, borderColor: tokens.border.default }}>
                <Search size={15} color={tokens.text.tertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={picker === "cardio" ? "Search cardio" : "Search lifts"}
                  placeholderTextColor={tokens.text.tertiary}
                  style={{ flex: 1, fontSize: 14, color: tokens.text.primary, padding: 0 }}
                />
                {query ? (
                  <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={8}>
                    <X size={14} color={tokens.text.tertiary} />
                  </Pressable>
                ) : null}
              </View>
              {picker === "lift" && !query ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
                  {["All", ...LIFT_MUSCLES].map((m) => {
                    const sel = group === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setGroup(m)}
                        style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: sel ? tokens.text.primary : tokens.bg.subtle }}
                      >
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: sel ? colors.black : tokens.text.secondary }}>{m}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 16 }}>
              <View style={{ gap: 8 }}>
                {pickerResults.map((item) => {
                  const best = session.bests[item.name] ?? 0;
                  const meta =
                    picker === "cardio"
                      ? best > 0
                        ? `best ${best} mi`
                        : `${item.min ?? 20} min · ${item.mi ?? 0} mi`
                      : best > 0
                        ? isRepsGraded(item.name)
                          ? `PR ${best} reps`
                          : `PR ${best} lb`
                        : `${item.w === 0 ? "BW" : `${item.w ?? 45} lb`} × ${item.r ?? 10}`;
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => pick(item)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 13,
                        borderWidth: 1,
                        borderColor: tokens.border.default,
                        backgroundColor: tokens.bg.subtle,
                        borderRadius: radius.md,
                        paddingVertical: 14,
                        paddingHorizontal: 16
                      }}
                    >
                      {picker === "cardio" ? (
                        <Flame size={18} color={tokens.accent.gold} strokeWidth={1.7} />
                      ) : (
                        <Dumbbell size={19} color={tokens.accent.gold} strokeWidth={1.8} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.text.primary }}>
                          {item.name}
                          {item.custom ? <Text style={{ fontSize: 10, color: tokens.text.tertiary }}>{"  Custom"}</Text> : null}
                        </Text>
                        <Text style={{ marginTop: 1, fontSize: 12, color: tokens.text.tertiary }}>{meta}</Text>
                      </View>
                      <ChevronRight size={17} color={tokens.text.tertiary} />
                    </Pressable>
                  );
                })}
                {pickerResults.length === 0 ? (
                  <Text style={{ paddingVertical: 16, fontSize: 13.5, color: tokens.text.tertiary, textAlign: "center" }}>
                    Nothing matches — add it as a custom {picker === "cardio" ? "activity" : "lift"} below.
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <TextInput
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder={picker === "cardio" ? "Add custom activity…" : "Add custom lift…"}
                  placeholderTextColor={tokens.text.tertiary}
                  onSubmitEditing={addCustom}
                  style={{
                    flex: 1,
                    backgroundColor: tokens.bg.base,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: radius.md,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 15,
                    color: tokens.text.primary
                  }}
                />
                <Pressable
                  onPress={addCustom}
                  disabled={!customText.trim()}
                  style={{
                    justifyContent: "center",
                    borderRadius: radius.md,
                    paddingHorizontal: 20,
                    backgroundColor: tokens.accent.gold,
                    opacity: customText.trim() ? 1 : 0.4
                  }}
                >
                  <Text style={{ fontFamily: DISP, fontSize: 15, color: colors.black }}>Add</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ---------------------------- logger sheet --------------------------- */}
      <Modal visible={Boolean(active)} transparent animationType="slide" onRequestClose={closeLogger}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.62)" }} onPress={closeLogger}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
          <Pressable
            onPress={(e) => { e.stopPropagation(); dismissKeyboardFromPress(e); }}
            style={{
              marginTop: "auto",
              maxHeight: "88%",
              backgroundColor: tokens.bg.raised,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderTopWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              overflow: "hidden"
            }}
          >
            <SheetGrip onDismiss={closeLogger} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 6, paddingBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
                  {isLift ? <Dumbbell size={20} color={tokens.accent.gold} strokeWidth={1.8} /> : <Flame size={19} color={tokens.accent.gold} strokeWidth={1.7} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 22, color: tokens.text.primary }}>
                    {active?.name ?? ""}
                  </Text>
                  <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: tokens.accent.gold }}>
                    {active
                      ? (() => {
                          const best = session.bests[active.name] ?? 0;
                          if (best <= 0) return "No PR yet — set one today";
                          if (active.kind === "cardio") return `Best · ${best} mi`;
                          return isRepsGraded(active.name) ? `Current PR · ${best} reps` : `Current PR · ${best} lb`;
                        })()
                      : ""}
                  </Text>
                </View>
              </View>
              <Pressable accessibilityLabel="Close logger" onPress={closeLogger} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tokens.bg.subtle, alignItems: "center", justifyContent: "center" }}>
                <X size={17} color={tokens.text.secondary} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 26 }}>
              {/* steppers */}
              <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: 22 }}>
                {(
                  [
                    {
                      label: isLift ? "Weight · lb" : "Distance · mi",
                      value: a,
                      onText: (v: string) => setA(sanitizeDec(v)),
                      dec: () => step(setA, isLift ? -5 : -0.5),
                      inc: () => step(setA, isLift ? 5 : 0.5)
                    },
                    {
                      label: isLift ? "Reps" : "Minutes",
                      value: b,
                      onText: (v: string) => setB(v.replace(/[^0-9]/g, "")),
                      dec: () => step(setB, -1),
                      inc: () => step(setB, 1)
                    }
                  ] as const
                ).map((f) => (
                  <View key={f.label} style={{ flex: 1, backgroundColor: tokens.bg.subtle, borderWidth: 1, borderColor: tokens.border.default, borderRadius: radius.lg, padding: 16 }}>
                    <Micro style={{ textAlign: "center", letterSpacing: 1.5 }}>{f.label}</Micro>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <Pressable accessibilityLabel={`Decrease ${f.label}`} onPress={f.dec} style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: tokens.bg.base, alignItems: "center", justifyContent: "center" }}>
                        <Minus size={20} color={tokens.text.primary} />
                      </Pressable>
                      <TextInput
                        value={f.value}
                        onChangeText={f.onText}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                        accessibilityLabel={f.label}
                        style={{ width: 76, textAlign: "center", fontFamily: NUM, fontSize: 28, color: tokens.text.primary, padding: 0 }}
                      />
                      <Pressable accessibilityLabel={`Increase ${f.label}`} onPress={f.inc} style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: tokens.bg.base, alignItems: "center", justifyContent: "center" }}>
                        <Plus size={20} color={tokens.text.primary} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
                {logError ? (
                  <Text style={{ marginBottom: 8, textAlign: "center", fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: "#FF5C5C" }}>
                    {logError}
                  </Text>
                ) : null}
                <Pressable
                  onPress={logSet}
                  style={{ paddingVertical: 17, borderRadius: radius.md, backgroundColor: tokens.accent.gold, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: DISP, fontSize: 17, color: colors.black }}>{isLift ? "Log set" : "Log interval"}</Text>
                </Pressable>
              </View>

              {/* logged sets */}
              <View style={{ paddingHorizontal: 22, paddingTop: 18, gap: 8 }}>
                {active && active.sets.length > 0 ? (
                  active.sets.map((s, i) => setRow(active, s, i))
                ) : (
                  <Text style={{ textAlign: "center", paddingVertical: 20, fontSize: 14, color: tokens.text.tertiary }}>
                    {isLift ? "Dial in weight × reps, then log your set." : "Set distance & time, then log the interval."}
                  </Text>
                )}
              </View>
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>

        {/* PR celebration renders over the logger too */}
        {celebrating ? <PrCelebration text={celebrating.text} confKey={confKey} /> : null}
      </Modal>

      {/* PR celebration (when logger is closed) */}
      {celebrating && !active ? <PrCelebration text={celebrating.text} confKey={confKey} /> : null}
    </View>
  );
}

/** Full-screen PR flash: gold badge pop + confetti (prototype `celebrating`). */
function PrCelebration({ text, confKey }: { text: string; confKey: number }) {
  const scale = useSharedValue(0.4);
  const flash = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 200 });
    flash.value = withSequence(withTiming(0.5, { duration: 130 }), withTiming(0, { duration: 970 }));
  }, [scale, flash]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 70 }}>
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.accent.gold }, flashStyle]}
      />
      <Animated.View style={[{ position: "absolute", top: "32%", left: 0, right: 0, alignItems: "center" }, badgeStyle]}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: tokens.accent.gold,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: tokens.accent.gold,
            shadowOpacity: 0.7,
            shadowRadius: 24,
            elevation: 12
          }}
        >
          <Trophy size={48} color={colors.black} strokeWidth={1.8} />
        </View>
        <Text style={{ marginTop: 16, fontFamily: DISP, fontSize: 30, letterSpacing: -0.5, color: tokens.text.primary }}>NEW PR!</Text>
        <Text style={{ marginTop: 4, fontFamily: "Geist_600SemiBold", fontSize: 16, color: tokens.accent.gold }}>{text}</Text>
      </Animated.View>
      <Confetti seed={confKey} />
    </View>
  );
}
