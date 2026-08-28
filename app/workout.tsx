import { LinearGradient } from "expo-linear-gradient";
import { appAlert } from "@/components/ui/AppDialog";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bookmark, Camera, Check, ChevronLeft, Dumbbell, Pencil, Plus, Repeat, Timer, TimerOff, Trash2, Trophy } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
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

import { Button } from "@/components/ui/Button";
import { Confetti } from "@/components/workout/Confetti";
import { DraggableList } from "@/components/workout/DraggableList";
import { ExerciseCard, type EditField } from "@/components/workout/ExerciseCard";
import { GlassSurface } from "@/components/workout/GlassSurface";
import { RestTimerPill } from "@/components/workout/RestTimerPill";
import { DISP, MED, NUM, SEMI, W } from "@/components/workout/wtheme";
import type { TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { useUserLifts } from "@/hooks/queries/useUserLifts";
import { repeatWorkoutName, repeatableExercises } from "@/lib/repeatWorkout";
import { applyPRFlags, derivePRs } from "@/lib/sessionPRs";
import {
  useDeleteRoutine,
  useMarkRoutineUsed,
  useRenameRoutine,
  useRoutine,
  useRoutines
} from "@/hooks/queries/useRoutines";
import {
  deriveExerciseBests,
  isRepsGraded,
  useAttachWorkoutToDaily,
  useRenameWorkout,
  useSaveWorkout,
  useTodayDailyPost,
  useUpdateWorkout,
  useWorkout,
  useWorkouts,
  type CardioSet,
  type LiftSet,
  type SessionPR,
  type WorkoutExercise
} from "@/hooks/queries/useWorkouts";
import { impactHaptic, successHaptic, workoutFinishedHaptics } from "@/lib/haptics";
import { fmtClock, sessionTitle } from "@/lib/workoutLibrary";
import { showToast } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";
import { durationBucket, trackAnalyticsEvent } from "@/lib/analytics";

let _id = Date.now() % 10_000_000;
const uid = () => ++_id;

/** The blinking LIVE dot. */
function BlinkDot({ size = 8 }: { size?: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: W.text }, style]} />
  );
}

/** App-style micro label — 11 Medium, 0.6 tracking, caps. */
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

type Celebration = { text: string };

type Summary = {
  title: string;
  volume: number;
  sets: number;
  reps: number;
  cardioMin: number;
  duration: number;
  exCount: number;
  prs: SessionPR[];
  celebrations: TrophyShareData[];
};

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Opening the exercise picker is reachable from three buttons, and a fast
  // double-tap used to PUSH TWO identical /workout/select screens. Backing out
  // then landed you on the second copy — visually identical — so it read as
  // "back didn't work", intermittently, until enough backs unwound the stack
  // (or you force-reloaded). One short lock makes the push idempotent.
  const openingSelect = useRef(false);
  const openExercisePicker = useCallback(() => {
    if (openingSelect.current) return;
    openingSelect.current = true;
    router.push("/workout/select" as never);
    setTimeout(() => {
      openingSelect.current = false;
    }, 700);
  }, [router]);
  // daily=1 → this workout is tied to today's daily post: finishing prompts
  // the daily photo, and publishing attaches this workout as a feed slide.
  const params = useLocalSearchParams<{ daily?: string; edit?: string; repeat?: string; routine?: string }>();
  const dailyTied = params.daily === "1";
  // Edit mode: /workout?edit=<id> opens this logger pre-filled from the saved
  // workout; finishing overwrites the row instead of inserting.
  const editingId = typeof params.edit === "string" && params.edit ? params.edit : null;
  // Repeat mode: /workout?repeat=<id> starts a NEW session shaped like a past
  // one — same exercises and last time's numbers as targets, nothing checked
  // off. Unlike edit, the original row is untouched.
  const repeatId = typeof params.repeat === "string" && params.repeat ? params.repeat : null;
  // Routine mode: /workout?routine=<id> starts a saved template.
  const routineId = typeof params.routine === "string" && params.routine ? params.routine : null;
  const editTarget = useWorkout(editingId ?? repeatId);
  const routineTarget = useRoutine(routineId);
  const routines = useRoutines();
  const deleteRoutine = useDeleteRoutine();
  const markRoutineUsed = useMarkRoutineUsed();
  const renameRoutine = useRenameRoutine();
  const [renamingRoutine, setRenamingRoutine] = useState<string | null>(null);
  const [routineNameDraft, setRoutineNameDraft] = useState("");
  const updateWorkout = useUpdateWorkout();
  const userId = useAuthStore((s) => s.userId);
  const saveWorkout = useSaveWorkout();

  const session = useWorkoutSession();
  const workouts = useWorkouts(userId);
  const lifts = useUserLifts(userId);
  const todayDaily = useTodayDailyPost(userId);
  const attachToDaily = useAttachWorkoutToDaily();
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);
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

  // Start (or resume) the session on mount. Prune exercises with no sets left
  // behind if the app closed mid-build. Timer starts explicitly (Start) or
  // implicitly on the first checked set.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (useWorkoutSession.getState().active) {
      useWorkoutSession.getState().setExercises((prev) => prev.filter((ex) => ex.sets.length > 0));
    } else {
      useWorkoutSession.getState().clear();
    }
  }, []);

  // Seed the PR detector with bests from history + canonical lifts.
  const derivedBests = useMemo(
    () =>
      deriveExerciseBests(
        // Editing an old workout: its own sets must not count as the record to
        // beat, or nothing in it could ever read as a PR.
        editingId ? (workouts.data ?? []).filter((w) => w.id !== editingId) : workouts.data,
        lifts.data
      ),
    [workouts.data, lifts.data, editingId]
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

  const [restSignal, setRestSignal] = useState(0);

  // PR celebration overlay.
  const [celebrating, setCelebrating] = useState<Celebration | null>(null);
  const [confKey, setConfKey] = useState(0);
  const celebTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (celebTimer.current) clearTimeout(celebTimer.current);
    },
    []
  );

  // Trophy cascade + summary count-up.
  const [animVol, setAnimVol] = useState(0);
  const [saving, setSaving] = useState(false);
  // Custom workout name set during the session (pencil in the header). Backed
  // by the session STORE, not local state — the session survives leaving the
  // screen and app restarts, and the name must survive with it (beta: "none of
  // my lifting section names are saving").
  const customName = session.name;
  const setCustomName = session.setName;
  const [namingLive, setNamingLive] = useState(false);
  // One-shot hydration of the session store from the workout being edited or
  // repeated.
  const hydratedEditRef = useRef<string | null>(null);
  useEffect(() => {
    const sourceId = editingId ?? repeatId;
    if (!sourceId || !editTarget.data || hydratedEditRef.current === sourceId) return;
    const live = useWorkoutSession.getState();
    if (live.active && live.exercises.some((ex) => ex.sets.length > 0)) {
      showToast(
        editingId
          ? "Finish your current workout before editing an old one"
          : "Finish your current workout first"
      );
      router.back();
      return;
    }
    hydratedEditRef.current = sourceId;
    const saved = editTarget.data;
    live.start();
    if (repeatId) {
      // Fresh run: same plan, nothing done yet.
      live.setExercises(() => repeatableExercises(saved.exercises));
      setCustomName(repeatWorkoutName(saved.name));
      trackAnalyticsEvent("workout_started", { source: "repeat" });
    } else {
      live.setExercises(() => saved.exercises);
      setCustomName(saved.name);
      trackAnalyticsEvent("workout_started", { source: "edit" });
    }
  }, [editingId, repeatId, editTarget.data, router, setCustomName]);

  /**
   * Recent workouts worth offering as a routine.
   *
   * Deduped by the exercises they contain, not by name — logging "Push Day"
   * three times shouldn't fill the list with three identical entries, and two
   * differently-named sessions with the same lifts are the same routine. Empty
   * sessions are skipped; there's nothing to repeat.
   */
  const recentRoutines = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; detail: string }[] = [];
    for (const workout of workouts.data ?? []) {
      const names = workout.exercises.filter((ex) => ex.sets.some((set) => set.done)).map((ex) => ex.name);
      if (names.length === 0) continue;
      const signature = names.slice().sort().join("|").toLowerCase();
      if (seen.has(signature)) continue;
      seen.add(signature);
      out.push({
        id: workout.id,
        name: workout.name,
        detail: names.length <= 3 ? names.join(" · ") : `${names.slice(0, 2).join(" · ")} +${names.length - 2} more`
      });
      if (out.length === 3) break;
    }
    return out;
  }, [workouts.data]);

  // One-shot hydration from a saved routine.
  const hydratedRoutineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!routineId || !routineTarget.data || hydratedRoutineRef.current === routineId) return;
    const live = useWorkoutSession.getState();
    if (live.active && live.exercises.some((ex) => ex.sets.length > 0)) {
      showToast("Finish your current workout first");
      router.back();
      return;
    }
    hydratedRoutineRef.current = routineId;
    const routine = routineTarget.data;
    live.start();
    // Belt and braces: routines are stored with nothing checked off, but a row
    // written by an older build shouldn't start a session half-complete.
    live.setExercises(() => repeatableExercises(routine.exercises));
    setCustomName(routine.name);
    markRoutineUsed.mutate(routineId);
    trackAnalyticsEvent("workout_started", { source: "routine" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId, routineTarget.data, router]);

  const commitRoutineRename = () => {
    const id = renamingRoutine;
    setRenamingRoutine(null);
    const next = routineNameDraft.trim();
    if (!id || !next) return;
    const current = (routines.data ?? []).find((r) => r.id === id);
    if (current && current.name === next) return;
    renameRoutine.mutate({ routineId: id, name: next });
  };

  const exercises = session.exercises;
  // True while a card is lifted — freezes the ScrollView so the drag owns
  // the gesture.
  const [dragging, setDragging] = useState(false);
  const reorderExercises = useCallback(
    (next: typeof exercises) => session.setExercises(() => next),
    [session]
  );

  // Done-set totals (what saves + the bottom bar show) — matches the saved
  // aggregate math in useWorkouts.
  const totals = useMemo(() => {
    let vol = 0;
    let done = 0;
    let all = 0;
    let reps = 0;
    let cardioMin = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        all += 1;
        if (!s.done) continue;
        done += 1;
        if (ex.kind === "lift") {
          vol += (s as LiftSet).w * (s as LiftSet).r;
          reps += (s as LiftSet).r;
        } else {
          cardioMin += (s as CardioSet).min;
        }
      }
    }
    return { vol, done, all, reps, cardioMin };
  }, [exercises]);

  /** Start the clock, keeping anything set up before pressing Start. */
  const startSession = () => {
    const state = useWorkoutSession.getState();
    if (state.active) return;
    const kept = state.exercises;
    state.start();
    if (kept.length > 0) state.setExercises(() => kept);
    state.seedBests(derivedBests);
    trackAnalyticsEvent("workout_started", { source: "fresh" });
  };

  /** Clone the previous row's numbers into a new unchecked row. */
  const addSet = (exId: number) => {
    session.setExercises((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e;
        const last = e.sets[e.sets.length - 1];
        if (e.kind === "cardio") {
          const l = last as CardioSet | undefined;
          const s: CardioSet = {
            id: uid(),
            min: l ? l.min : e.defMin,
            mi: l ? l.mi : e.defMi,
            ...(e.hasInc ? { inc: l?.inc ?? e.defInc ?? 0 } : {}),
            done: false
          };
          return { ...e, sets: [...e.sets, s] };
        }
        const l = last as LiftSet | undefined;
        const s: LiftSet = { id: uid(), w: l ? l.w : e.defW, r: l ? l.r : e.defR, done: false };
        return { ...e, sets: [...e.sets, s] };
      })
    );
    void impactHaptic();
  };

  const removeExercise = (exId: number) => {
    session.setExercises((prev) => prev.filter((e) => e.id !== exId));
    void impactHaptic();
  };

  const removeSet = (exId: number, setId: number) => {
    session.setExercises((prev) =>
      prev.map((e) => (e.id === exId ? ({ ...e, sets: e.sets.filter((s) => s.id !== setId) } as WorkoutExercise) : e))
    );
    void impactHaptic();
  };

  const applyValue = (exId: number, setId: number, field: EditField, value: number) => {
    session.setExercises((prev) =>
      prev.map((e) =>
        e.id === exId
          ? ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) } as WorkoutExercise)
          : e
      )
    );
  };

  /** Check/uncheck a set. Checking = logging: starts the clock, runs PR
   *  detection, fires the rest timer. Unchecking never un-awards. */
  const toggleDone = (exId: number, setId: number) => {
    const entry = exercises.find((e) => e.id === exId);
    const set = entry?.sets.find((s) => s.id === setId);
    if (!entry || !set) return;

    if (set.done) {
      session.setExercises((prev) =>
        prev.map((e) =>
          e.id === exId ? ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, done: false } : s)) } as WorkoutExercise) : e
        )
      );
      void impactHaptic();
      return;
    }

    // A row needs real numbers before it can count as logged.
    if (entry.kind === "lift" && ((set as LiftSet).r < 1 || (set as LiftSet).r > 200)) {
      showToast("Add your reps first (1–200)");
      return;
    }
    if (entry.kind === "cardio" && ((set as CardioSet).min < 1 || (set as CardioSet).min > 600)) {
      showToast("Add your minutes first (1–600)");
      return;
    }

    startSession();
    let isPR = false;
    let prInfo: SessionPR | null = null;
    let newBest = 0;
    if (entry.kind === "lift") {
      const { w, r } = set as LiftSet;
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
    } else {
      const { mi } = set as CardioSet;
      const cur = useWorkoutSession.getState().bests[entry.name] ?? 0;
      if (mi > cur && mi > 0) {
        isPR = true;
        newBest = mi;
        prInfo = { name: entry.name, value: `${mi} mi`, was: cur > 0 ? `was ${cur} mi` : "first log" };
      }
    }

    session.setExercises((prev) =>
      prev.map((e) =>
        e.id === exId
          ? ({
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, done: true, ...(isPR ? { pr: true } : {}) } : s))
            } as WorkoutExercise)
          : e
      )
    );

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
    // Rest countdown after every logged set (user-toggleable; never while
    // editing an old workout).
    if (!editingId && useWorkoutSession.getState().restTimerEnabled) setRestSignal((n) => n + 1);
  };

  // Escape hatch for an accidental session: with nothing logged, the footer
  // button becomes "Discard workout" instead of a dead disabled Finish —
  // without this, an active session with zero checked sets was unexitable
  // (it persists to disk and survives restarts).
  const discard = () => {
    appAlert(
      editingId ? "Discard changes?" : "Discard workout?",
      editingId
        ? "Your edits to this workout won't be saved."
        : "Nothing is logged yet — this workout will be thrown away.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            trackAnalyticsEvent("workout_discarded", { sets_logged: totals.done });
            session.clear();
            router.back();
          }
        }
      ]
    );
  };

  const finish = async () => {
    if (totals.done === 0 || !userId || saving) return;
    if (editingId && editTarget.data) {
      setSaving(true);
      // Editing is exactly the path that used to strand a bad PR: the sets get
      // corrected while `prs` was carried over untouched. Re-derive both.
      const logged = applyPRFlags(exercises.filter((e) => e.sets.length > 0), derivedBests);
      updateWorkout.mutate(
        {
          workoutId: editingId,
          name: customName.trim() || editTarget.data.name,
          exercises: logged,
          prs: derivePRs(logged, derivedBests)
        },
        {
          onSuccess: () => {
            trackAnalyticsEvent("workout_completed", {
              duration_bucket: durationBucket(editTarget.data?.durationSeconds ?? 0),
              exercises: logged.length,
              sets: totals.done,
              prs: derivePRs(logged, derivedBests).length,
              edited: true
            });
            session.clear();
            void successHaptic().catch(() => {});
            showToast("Workout updated");
            router.back();
          },
          onError: () => {
            setSaving(false);
            showToast("Couldn't save changes — try again");
          }
        }
      );
      return;
    }
    setSaving(true);
    const hasLift = exercises.some((e) => e.kind === "lift" && e.sets.some((s) => s.done));
    const hasCardio = exercises.some((e) => e.kind === "cardio" && e.sets.some((s) => s.done));
    const title = customName.trim() || sessionTitle(hasLift, hasCardio);
    // PRs are DERIVED from the final sets, not from the running list the live
    // detector built — a mistyped weight that gets corrected must not leave a
    // record behind (see lib/sessionPRs).
    const logged = applyPRFlags(exercises.filter((e) => e.sets.length > 0), derivedBests);
    const finalPRs = derivePRs(logged, derivedBests);
    try {
      const result = await saveWorkout.mutateAsync({
        userId,
        name: title,
        startedAt: session.startedAt,
        durationSeconds: elapsed,
        exercises: logged,
        sessionPRs: finalPRs
      });
      setSavedWorkoutId(result.workoutId);
      trackAnalyticsEvent("workout_completed", {
        duration_bucket: durationBucket(elapsed),
        exercises: logged.length,
        sets: totals.done,
        prs: finalPRs.length,
        source: routineId ? "routine" : repeatId ? "repeat" : "fresh",
        edited: false
      });
      setSummary({
        title,
        volume: totals.vol,
        sets: totals.done,
        reps: totals.reps,
        cardioMin: totals.cardioMin,
        duration: elapsed,
        exCount: logged.filter((e) => e.sets.some((s) => s.done)).length,
        prs: finalPRs,
        celebrations: result.celebrations
      });
      setConfKey((k) => k + 1);
      setRestSignal(0);
      // Celebration burst, in time with the confetti — bigger when PRs landed.
      void workoutFinishedHaptics(finalPRs.length);
    } catch {
      showToast("Couldn't save your workout — check your connection");
    } finally {
      setSaving(false);
    }
  };

  // Summary volume count-up (cubic ease-out over 900ms).
  useEffect(() => {
    if (!summary) return;
    const target = summary.volume > 0 ? summary.volume : summary.cardioMin;
    if (target <= 0) {
      setAnimVol(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimVol(Math.round(target * eased));
      if (p >= 1) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [summary]);

  const done = () => {
    session.clear();
    router.back();
  };

  /* ------------------------------- summary -------------------------------- */

  if (summary) {
    const headlineIsVolume = summary.volume > 0;
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <LinearGradient
          colors={[tokens.bg.raised, colors.black]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300 }}
        />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 44, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
          <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
            <CheckPop />
            {editingName ? (
              <TextInput
                autoFocus
                value={nameDraft}
                onChangeText={setNameDraft}
                onSubmitEditing={commitRename}
                onBlur={commitRename}
                maxLength={60}
                style={{
                  marginTop: 22,
                  minWidth: 200,
                  textAlign: "center",
                  fontFamily: DISP,
                  fontSize: 24,
                  color: W.text,
                  borderBottomWidth: 1,
                  borderBottomColor: W.strong,
                  paddingVertical: 4
                }}
              />
            ) : (
              <Pressable
                onPress={startRename}
                accessibilityLabel="Rename workout"
                style={{ marginTop: 22, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 }}
              >
                <Text
                  style={{
                    fontFamily: DISP,
                    fontSize: 24,
                    letterSpacing: 24 * -0.02,
                    lineHeight: 30,
                    color: W.text,
                    textAlign: "center",
                    flexShrink: 1
                  }}
                >
                  {summary.title} logged
                </Text>
                <Pencil size={14} color={W.faint} strokeWidth={2} />
              </Pressable>
            )}
            <Micro style={{ marginTop: 10, color: W.muted }}>
              {fmtClock(summary.duration)} · {summary.exCount} {summary.exCount === 1 ? "exercise" : "exercises"}
            </Micro>

            <Text style={{ marginTop: 30, fontFamily: NUM, fontSize: 56, lineHeight: 60, color: W.text }}>
              {animVol.toLocaleString()}
            </Text>
            <Micro style={{ marginTop: 4 }}>{headlineIsVolume ? "Total volume · lb" : "Cardio · min"}</Micro>

            <View style={{ flexDirection: "row", gap: 36, marginTop: 28 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: NUM, fontSize: 26, color: W.text }}>{summary.sets}</Text>
                <Micro style={{ marginTop: 3 }}>Sets</Micro>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: NUM, fontSize: 26, color: W.text }}>{summary.reps}</Text>
                <Micro style={{ marginTop: 3 }}>Reps</Micro>
              </View>
              {headlineIsVolume && summary.cardioMin > 0 ? (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontFamily: NUM, fontSize: 26, color: W.text }}>{summary.cardioMin}</Text>
                  <Micro style={{ marginTop: 3 }}>Cardio · min</Micro>
                </View>
              ) : null}
            </View>

            {/* real reward chips: PRs */}
            {summary.prs.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 28 }}>
                {summary.prs.map((pr) => (
                  <View
                    key={pr.name}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                      backgroundColor: tokens.accent.goldSubtle,
                      borderWidth: 1,
                      borderColor: "rgba(232,180,76,0.35)"
                    }}
                  >
                    <Trophy size={14} color={tokens.accent.gold} strokeWidth={1.8} />
                    <Text style={{ fontFamily: SEMI, fontSize: 12.5, color: W.text }}>
                      PR · {pr.name} {pr.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: "auto", paddingHorizontal: 24, paddingTop: 28, gap: 10 }}>
            {dailyTied || !todayDaily.data ? (
              <>
                <Button
                  icon={<Camera size={17} color={colors.black} />}
                  onPress={() => {
                    session.clear();
                    const suffix = savedWorkoutId ? `&workout=${savedWorkoutId}` : "";
                    router.replace(`/camera?mode=daily${suffix}` as never);
                  }}
                >
                  Post today&apos;s SPOTTED
                </Button>
                <Button variant="ghost" onPress={done}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button
                  icon={attached ? undefined : <Plus size={17} color={colors.black} />}
                  disabled={attached || attachToDaily.isPending}
                  loading={attachToDaily.isPending}
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
                >
                  {attached ? "Added to today's post" : "Add to today's daily post"}
                </Button>
                <Button variant="ghost" onPress={done}>
                  Done
                </Button>
              </>
            )}
          </View>
        </ScrollView>

        <Confetti seed={confKey} />

      </View>
    );
  }

  /* ------------------------------- builder -------------------------------- */

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {/* header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: W.line
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
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
            <ChevronLeft size={18} color={W.muted} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            {namingLive ? (
              <TextInput
                autoFocus
                value={customName}
                onChangeText={setCustomName}
                maxLength={60}
                placeholder="Name this workout"
                placeholderTextColor={W.faint}
                onSubmitEditing={() => setNamingLive(false)}
                onBlur={() => setNamingLive(false)}
                style={{
                  fontFamily: DISP,
                  fontSize: 20,
                  color: W.text,
                  borderBottomWidth: 1,
                  borderBottomColor: W.strong,
                  paddingVertical: 2
                }}
              />
            ) : (
              <Pressable
                onPress={() => setNamingLive(true)}
                accessibilityLabel="Name this workout"
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text
                  numberOfLines={1}
                  style={{ flexShrink: 1, fontFamily: DISP, fontSize: 21, letterSpacing: 21 * -0.02, color: W.text }}
                >
                  {customName.trim() || "Workout"}
                </Text>
                <Pencil size={13} color={W.faint} strokeWidth={2} />
              </Pressable>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              {session.active ? (
                <>
                  <BlinkDot />
                  <Text style={{ fontFamily: SEMI, fontSize: 12.5, color: W.text }}>Live</Text>
                  <Text style={{ fontFamily: "Geist_400Regular", fontSize: 12.5, color: W.muted }}>
                    · {fmtClock(elapsed)}
                  </Text>
                </>
              ) : (
                <Text style={{ fontFamily: "Geist_400Regular", fontSize: 12.5, color: W.muted }}>
                  Ready — log a set to start the clock
                </Text>
              )}
            </View>
          </View>
          {/* rest-timer preference — optional auto countdown after each set */}
          <Pressable
            accessibilityLabel={session.restTimerEnabled ? "Turn off the rest timer" : "Turn on the rest timer"}
            accessibilityState={{ selected: session.restTimerEnabled }}
            onPress={() => {
              const turningOff = session.restTimerEnabled;
              session.toggleRestTimer();
              if (turningOff) setRestSignal(0);
              showToast(turningOff ? "Rest timer off" : "Rest timer on — 90s after each set");
            }}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: W.line,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8
            }}
          >
            {session.restTimerEnabled ? (
              <Timer size={17} color={W.text} strokeWidth={2} />
            ) : (
              <TimerOff size={17} color={W.faint} strokeWidth={2} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Add exercises"
            onPress={openExercisePicker}
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
            <Plus size={18} color={W.text} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        // A lifted card owns the gesture — scrolling would fight it.
        scrollEnabled={!dragging}
      >
        {exercises.length === 0 ? (
          <View style={{ paddingTop: 44, paddingHorizontal: 24, alignItems: "center" }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 2,
                borderColor: tokens.accent.gold,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Dumbbell size={38} color={tokens.accent.gold} strokeWidth={1.7} />
            </View>
            <Text
              style={{
                marginTop: 22,
                fontFamily: DISP,
                fontSize: 22,
                letterSpacing: 22 * -0.02,
                color: W.text,
                textAlign: "center"
              }}
            >
              Build today&apos;s workout
            </Text>
            <Text
              style={{
                marginTop: 10,
                fontFamily: "Geist_400Regular",
                fontSize: 14.5,
                lineHeight: 21,
                color: W.faint,
                textAlign: "center",
                maxWidth: 280
              }}
            >
              Add exercises, then check off sets as you go. Lifts log in reps × lbs, cardio in minutes.
            </Text>
            <Button
              className="mt-6 self-stretch"
              icon={<Plus size={16} color={colors.black} />}
              onPress={openExercisePicker}
            >
              Add exercises
            </Button>

            {/* Saved routines — templates you named and kept, independent of
                history: they don't age out as you log more sessions. */}
            {(routines.data ?? []).length > 0 ? (
              <View style={{ alignSelf: "stretch", marginTop: 28 }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 11, letterSpacing: 1.4, color: W.faint, marginBottom: 10 }}>
                  MY ROUTINES
                </Text>
                {(routines.data ?? []).map((routine) => (
                  <View
                    key={routine.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 15,
                      marginBottom: 8,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: tokens.accent.gold,
                      backgroundColor: tokens.bg.raised
                    }}
                  >
                    <Pressable
                      accessibilityLabel={`Start ${routine.name}`}
                      onPress={() => router.replace(`/workout?routine=${routine.id}`)}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <Bookmark size={16} color={tokens.accent.gold} strokeWidth={2.2} />
                      <View style={{ flex: 1 }}>
                        {renamingRoutine === routine.id ? (
                          <TextInput
                            value={routineNameDraft}
                            onChangeText={setRoutineNameDraft}
                            autoFocus
                            selectTextOnFocus
                            maxLength={60}
                            returnKeyType="done"
                            onSubmitEditing={commitRoutineRename}
                            onBlur={commitRoutineRename}
                            accessibilityLabel="Routine name"
                            style={{ fontFamily: SEMI, fontSize: 14.5, color: W.text, padding: 0 }}
                          />
                        ) : (
                          <Text numberOfLines={1} style={{ fontFamily: SEMI, fontSize: 14.5, color: W.text }}>
                            {routine.name}
                          </Text>
                        )}
                        <Text style={{ marginTop: 2, fontSize: 12, color: W.faint }}>
                          {routine.exercises.length === 1
                            ? "1 exercise"
                            : `${routine.exercises.length} exercises`}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Rename ${routine.name}`}
                      hitSlop={10}
                      onPress={() => {
                        setRoutineNameDraft(routine.name);
                        setRenamingRoutine(routine.id);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Pencil size={15} color={W.muted} strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Delete ${routine.name}`}
                      hitSlop={10}
                      onPress={() =>
                        appAlert(`Delete "${routine.name}"?`, "Your logged workouts aren't affected.", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => deleteRoutine.mutate(routine.id)
                          }
                        ])
                      }
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={16} color="#E5484D" strokeWidth={2} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Repeat a recent one. Rebuilding the same split by hand every
                time was the ask — this is the shortcut, right where a session
                starts rather than buried in history. */}
            {recentRoutines.length > 0 ? (
              <View style={{ alignSelf: "stretch", marginTop: 28 }}>
                <Text
                  style={{
                    fontFamily: "Geist_600SemiBold",
                    fontSize: 11,
                    letterSpacing: 1.4,
                    color: W.faint,
                    marginBottom: 10
                  }}
                >
                  DO IT AGAIN
                </Text>
                {recentRoutines.map((routine) => (
                  <Pressable
                    key={routine.id}
                    accessibilityLabel={`Repeat ${routine.name}`}
                    onPress={() => router.replace(`/workout?repeat=${routine.id}`)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 13,
                      paddingHorizontal: 15,
                      marginBottom: 8,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: tokens.border.default,
                      backgroundColor: tokens.bg.raised
                    }}
                  >
                    <Repeat size={16} color={W.muted} strokeWidth={2.2} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontFamily: SEMI, fontSize: 14.5, color: W.text }}>
                        {routine.name}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: W.faint }}>
                        {routine.detail}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {/* Hold a card to lift it, drag to reorder — the list springs
                out of the way and snaps on release. */}
            <DraggableList
              data={exercises}
              keyExtractor={(e) => e.id}
              onDragActiveChange={setDragging}
              onReorder={reorderExercises}
              renderItem={(e) => (
                <ExerciseCard
                  exercise={e}
                  onSetValue={(setId, field, value) => applyValue(e.id, setId, field, value)}
                  onToggleDone={(setId) => toggleDone(e.id, setId)}
                  onAddSet={() => addSet(e.id)}
                  onRemoveSet={(setId) => removeSet(e.id, setId)}
                  onRemoveExercise={() => removeExercise(e.id)}
                />
              )}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add exercises"
              onPress={openExercisePicker}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 14,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: W.strong,
                backgroundColor: W.card
              }}
            >
              <Plus size={15} color={W.muted} strokeWidth={2.4} />
              <Text style={{ fontFamily: SEMI, fontSize: 13.5, color: W.muted }}>Add exercises</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* rest countdown — glass pill above the bottom bar */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 112 }}>
        <RestTimerPill signal={restSignal} onDone={() => setRestSignal(0)} />
      </View>

      {/* bottom bar — Liquid Glass, tab-bar material */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 14, right: 14, bottom: insets.bottom > 0 ? insets.bottom + 8 : 18 }}
      >
        <GlassSurface radius={radius.lg}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }}>
            <View style={{ marginRight: 20 }}>
              <Text style={{ fontFamily: NUM, fontSize: 22, lineHeight: 24, color: W.text }}>
                {totals.vol.toLocaleString()}
              </Text>
              <Micro style={{ marginTop: 2, color: "rgba(255,255,255,0.6)" }}>Volume · lb</Micro>
            </View>
            <View style={{ marginRight: 20 }}>
              <Text style={{ fontFamily: NUM, fontSize: 22, lineHeight: 24, color: W.text }}>
                {totals.done}
                <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 16 }}>/{totals.all}</Text>
              </Text>
              <Micro style={{ marginTop: 2, color: "rgba(255,255,255,0.6)" }}>Sets</Micro>
            </View>
            {totals.cardioMin > 0 ? (
              <View style={{ marginRight: 20 }}>
                <Text style={{ fontFamily: NUM, fontSize: 22, lineHeight: 24, color: W.text }}>{totals.cardioMin}</Text>
                <Micro style={{ marginTop: 2, color: "rgba(255,255,255,0.6)" }}>Cardio</Micro>
              </View>
            ) : null}
            <Pressable
              onPress={() => (totals.done > 0 ? void finish() : discard())}
              disabled={saving || (totals.done === 0 && !session.active && !editingId)}
              accessibilityRole="button"
              style={{
                flex: 1,
                height: 48,
                borderRadius: radius.pill,
                backgroundColor: totals.done > 0 ? colors.white : colors.iron,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text
                style={{
                  fontFamily: NUM,
                  fontSize: 14.5,
                  letterSpacing: 0.14,
                  color: totals.done > 0 ? colors.black : session.active || editingId ? W.text : colors.ash
                }}
              >
                {saving
                  ? "Saving…"
                  : totals.done === 0 && (session.active || editingId)
                    ? editingId
                      ? "Discard changes"
                      : "Discard workout"
                    : editingId
                      ? "Save changes"
                      : "Finish workout"}
              </Text>
            </Pressable>
          </View>
        </GlassSurface>
      </View>

      {/* PR celebration */}
      {celebrating ? <PrCelebration text={celebrating.text} confKey={confKey} /> : null}
    </View>
  );
}

/** Summary check circle with a pop-in. */
function CheckPop() {
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withSequence(withSpring(1.15, { damping: 11, stiffness: 320 }), withSpring(1, { damping: 15, stiffness: 280 }));
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      style={[
        { width: 64, height: 64, borderRadius: 32, backgroundColor: W.text, alignItems: "center", justifyContent: "center" },
        style
      ]}
    >
      <Check size={28} strokeWidth={3} color={W.ink} />
    </Animated.View>
  );
}

/** Full-screen PR flash: gold badge pop + confetti. */
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
        <Text style={{ marginTop: 16, fontFamily: DISP, fontSize: 28, letterSpacing: 28 * -0.02, color: W.text }}>New PR!</Text>
        <Text style={{ marginTop: 6, fontFamily: SEMI, fontSize: 15, color: tokens.accent.gold }}>{text}</Text>
      </Animated.View>
      <Confetti seed={confKey} />
    </View>
  );
}
