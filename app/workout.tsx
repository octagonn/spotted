import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { Confetti } from "@/components/workout/Confetti";
import { DraggableList } from "@/components/workout/DraggableList";
import { ExerciseCard, type EditField } from "@/components/workout/ExerciseCard";
import { PrCelebration } from "@/components/workout/PrCelebration";
import { RestTimerPill } from "@/components/workout/RestTimerPill";
import { WorkoutEmptyState, type RecentRoutine } from "@/components/workout/WorkoutEmptyState";
import { WorkoutFinishSummary, type WorkoutSummary } from "@/components/workout/WorkoutFinishSummary";
import { WorkoutHeader } from "@/components/workout/WorkoutHeader";
import { WorkoutLiveSummary, type WorkoutTotals } from "@/components/workout/WorkoutLiveSummary";
import {
  useDeleteRoutine,
  useMarkRoutineUsed,
  useRenameRoutine,
  useRoutine,
  useRoutines
} from "@/hooks/queries/useRoutines";
import { useUserLifts } from "@/hooks/queries/useUserLifts";
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
import { durationBucket, trackAnalyticsEvent } from "@/lib/analytics";
import { haptic, workoutFinishedHaptics } from "@/lib/haptics";
import { repeatWorkoutName, repeatableExercises } from "@/lib/repeatWorkout";
import { applyPRFlags, derivePRs } from "@/lib/sessionPRs";
import { sessionTitle } from "@/lib/workoutLibrary";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

// Set/exercise id generator. Seeded from the FULL epoch (no modulo): the
// counter reseeds on every JS reload while the in-progress session (and its
// old ids) survives in AsyncStorage — the old `% 10_000_000` seed wrapped
// every ~2.8h, so a reseed could replay ids already present in the restored
// session and hand React duplicate keys. Epoch ms always moves forward faster
// than sets are added, so a reseed can never land below a previous id.
let _id = Date.now();
const uid = () => ++_id;

/** Duration of the PR overlay before it dismisses itself. */
const PR_OVERLAY_MS = 1600;

/**
 * Workout logger. Owns the session lifecycle (start / hydrate / log / finish)
 * and composes: WorkoutHeader → exercise list (or WorkoutEmptyState) →
 * RestTimerPill → WorkoutLiveSummary; WorkoutFinishSummary after saving.
 */
export default function WorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Opening the exercise picker is reachable from three buttons, and a fast
  // double-tap used to PUSH TWO identical /workout/select screens. One short
  // lock makes the push idempotent.
  const openingSelect = useRef(false);
  const openExercisePicker = useCallback(() => {
    if (openingSelect.current) return;
    openingSelect.current = true;
    router.push("/workout/select" as never);
    setTimeout(() => {
      openingSelect.current = false;
    }, 700);
  }, [router]);

  // daily=1 → tied to today's daily post. edit=<id> → prefill + overwrite.
  // repeat=<id> → new session shaped like a past one. routine=<id> → template.
  const params = useLocalSearchParams<{ daily?: string; edit?: string; repeat?: string; routine?: string }>();
  const dailyTied = params.daily === "1";
  const editingId = typeof params.edit === "string" && params.edit ? params.edit : null;
  const repeatId = typeof params.repeat === "string" && params.repeat ? params.repeat : null;
  const routineId = typeof params.routine === "string" && params.routine ? params.routine : null;
  const editTarget = useWorkout(editingId ?? repeatId);
  const routineTarget = useRoutine(routineId);
  const routines = useRoutines();
  const deleteRoutine = useDeleteRoutine();
  const markRoutineUsed = useMarkRoutineUsed();
  const renameRoutine = useRenameRoutine();
  const updateWorkout = useUpdateWorkout();
  const userId = useAuthStore((s) => s.userId);
  const saveWorkout = useSaveWorkout();

  // Session store — field selectors, so a keystroke in one set input doesn't
  // re-render for unrelated fields; actions come from getState().
  const exercises = useWorkoutSession((s) => s.exercises);
  const active = useWorkoutSession((s) => s.active);
  const startedAt = useWorkoutSession((s) => s.startedAt);
  const customName = useWorkoutSession((s) => s.name);
  const restTimerEnabled = useWorkoutSession((s) => s.restTimerEnabled);
  const setExercises = useWorkoutSession((s) => s.setExercises);
  const setCustomName = useWorkoutSession((s) => s.setName);
  const workouts = useWorkouts(userId);
  const lifts = useUserLifts(userId);
  const todayDaily = useTodayDailyPost(userId);
  const attachToDaily = useAttachWorkoutToDaily();
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);
  const renameWorkout = useRenameWorkout();
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);

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
    if (Object.keys(derivedBests).length > 0) useWorkoutSession.getState().seedBests(derivedBests);
  }, [derivedBests]);

  const [restSignal, setRestSignal] = useState(0);

  // PR celebration overlay.
  const [celebrating, setCelebrating] = useState<{ text: string } | null>(null);
  const [confKey, setConfKey] = useState(0);
  const celebTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (celebTimer.current) clearTimeout(celebTimer.current);
    },
    []
  );

  const [saving, setSaving] = useState(false);

  // One-shot hydration of the session store from the workout being edited or
  // repeated.
  const hydratedEditRef = useRef<string | null>(null);
  useEffect(() => {
    const sourceId = editingId ?? repeatId;
    if (!sourceId || !editTarget.data || hydratedEditRef.current === sourceId) return;
    const live = useWorkoutSession.getState();
    if (live.active && live.exercises.some((ex) => ex.sets.length > 0)) {
      showToast(
        editingId ? "Finish your current workout before editing an old one" : "Finish your current workout first"
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
   * Recent workouts worth offering as a routine — deduped by the exercises
   * they contain, not by name. Empty sessions are skipped.
   */
  const recentRoutines = useMemo<RecentRoutine[]>(() => {
    const seen = new Set<string>();
    const out: RecentRoutine[] = [];
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
    // Routines are stored with nothing checked off, but a row written by an
    // older build shouldn't start a session half-complete.
    live.setExercises(() => repeatableExercises(routine.exercises));
    setCustomName(routine.name);
    markRoutineUsed.mutate(routineId);
    trackAnalyticsEvent("workout_started", { source: "routine" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId, routineTarget.data, router]);

  // True while a card is lifted — freezes the ScrollView so the drag owns
  // the gesture.
  const [dragging, setDragging] = useState(false);
  const reorderExercises = useCallback((next: WorkoutExercise[]) => setExercises(() => next), [setExercises]);

  // Done-set totals (what saves + the bottom bar show) — matches the saved
  // aggregate math in useWorkouts.
  const totals = useMemo<WorkoutTotals>(() => {
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
  const startSession = useCallback(() => {
    const state = useWorkoutSession.getState();
    if (state.active) return;
    const kept = state.exercises;
    state.start();
    if (kept.length > 0) state.setExercises(() => kept);
    state.seedBests(derivedBests);
    trackAnalyticsEvent("workout_started", { source: "fresh" });
  }, [derivedBests]);

  /** Clone the previous row's numbers into a new unchecked row. */
  const addSet = useCallback(
    (exId: number) => {
      setExercises((prev) =>
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
      haptic("impact");
    },
    [setExercises]
  );

  const removeExercise = useCallback(
    (exId: number) => {
      setExercises((prev) => prev.filter((e) => e.id !== exId));
      haptic("impact");
    },
    [setExercises]
  );

  const removeSet = useCallback(
    (exId: number, setId: number) => {
      setExercises((prev) =>
        prev.map((e) => (e.id === exId ? ({ ...e, sets: e.sets.filter((s) => s.id !== setId) } as WorkoutExercise) : e))
      );
      haptic("impact");
    },
    [setExercises]
  );

  const applyValue = useCallback(
    (exId: number, setId: number, field: EditField, value: number) => {
      setExercises((prev) =>
        prev.map((e) =>
          e.id === exId
            ? ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) } as WorkoutExercise)
            : e
        )
      );
    },
    [setExercises]
  );

  /** Check/uncheck a set. Checking = logging: starts the clock, runs PR
   *  detection, fires the rest timer. Unchecking never un-awards. */
  const toggleDone = useCallback(
    (exId: number, setId: number) => {
      const current = useWorkoutSession.getState().exercises;
      const entry = current.find((e) => e.id === exId);
      const set = entry?.sets.find((s) => s.id === setId);
      if (!entry || !set) return;

      if (set.done) {
        setExercises((prev) =>
          prev.map((e) =>
            e.id === exId
              ? ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, done: false } : s)) } as WorkoutExercise)
              : e
          )
        );
        haptic("impact");
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

      setExercises((prev) =>
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
        useWorkoutSession.getState().recordPR(prInfo, entry.name, newBest);
        setCelebrating({ text: `${entry.name} · ${prInfo.value}` });
        setConfKey((k) => k + 1);
        if (celebTimer.current) clearTimeout(celebTimer.current);
        celebTimer.current = setTimeout(() => setCelebrating(null), PR_OVERLAY_MS);
        haptic("success");
      } else {
        haptic("impact");
      }
      // Rest countdown after every logged set (user-toggleable; never while
      // editing an old workout).
      if (!editingId && useWorkoutSession.getState().restTimerEnabled) setRestSignal((n) => n + 1);
    },
    [editingId, setExercises, startSession]
  );

  // Escape hatch for an accidental session: with nothing logged, the footer
  // button becomes "Discard workout" instead of a dead disabled Finish.
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
            useWorkoutSession.getState().clear();
            router.back();
          }
        }
      ]
    );
  };

  const finish = async () => {
    if (totals.done === 0 || !userId || saving) return;
    const elapsed = active && startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    if (editingId && editTarget.data) {
      setSaving(true);
      // Editing is exactly the path that used to strand a bad PR: the sets get
      // corrected while `prs` was carried over untouched. Re-derive both.
      const logged = applyPRFlags(
        exercises.filter((e) => e.sets.length > 0),
        derivedBests
      );
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
            useWorkoutSession.getState().clear();
            haptic("success");
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
    const logged = applyPRFlags(
      exercises.filter((e) => e.sets.length > 0),
      derivedBests
    );
    const finalPRs = derivePRs(logged, derivedBests);
    try {
      const result = await saveWorkout.mutateAsync({
        userId,
        name: title,
        startedAt,
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

  const done = () => {
    useWorkoutSession.getState().clear();
    router.back();
  };

  const renameSaved = (next: string) => {
    setSummary((prev) => (prev ? { ...prev, title: next } : prev));
    if (savedWorkoutId) {
      renameWorkout.mutate(
        { workoutId: savedWorkoutId, name: next },
        { onError: () => showToast("Couldn't rename — try again") }
      );
    }
  };

  /* ------------------------------- summary -------------------------------- */

  if (summary) {
    return (
      <>
        <WorkoutFinishSummary summary={summary} onRename={renameSaved}>
          {dailyTied || !todayDaily.data ? (
            <>
              <Button
                icon={<Camera size={icon.size.xs + 1} color={colors.black} />}
                onPress={() => {
                  useWorkoutSession.getState().clear();
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
                icon={attached ? undefined : <Plus size={icon.size.xs + 1} color={colors.black} />}
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
        </WorkoutFinishSummary>
        <Confetti seed={confKey} />
      </>
    );
  }

  /* ------------------------------- builder -------------------------------- */

  const primaryLabel = saving
    ? "Saving…"
    : totals.done === 0 && (active || editingId)
      ? editingId
        ? "Discard changes"
        : "Discard workout"
      : editingId
        ? "Save changes"
        : "Finish workout";

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <WorkoutHeader
        name={customName}
        onChangeName={setCustomName}
        active={active}
        startedAt={startedAt}
        restTimerEnabled={restTimerEnabled}
        onToggleRestTimer={() => {
          const turningOff = restTimerEnabled;
          useWorkoutSession.getState().toggleRestTimer();
          if (turningOff) setRestSignal(0);
          showToast(turningOff ? "Rest timer off" : "Rest timer on — 90s after each set");
        }}
        onAddExercises={openExercisePicker}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // A lifted card owns the gesture — scrolling would fight it.
          scrollEnabled={!dragging}
        >
          {exercises.length === 0 ? (
            <WorkoutEmptyState
              routines={routines.data ?? []}
              recent={recentRoutines}
              onAddExercises={openExercisePicker}
              onStartRoutine={(id) => router.replace(`/workout?routine=${id}`)}
              onRenameRoutine={(id, name) => renameRoutine.mutate({ routineId: id, name })}
              onDeleteRoutine={(id) => deleteRoutine.mutate(id)}
              onRepeat={(id) => router.replace(`/workout?repeat=${id}`)}
            />
          ) : (
            <>
              {/* Hold a card to lift it, drag to reorder. */}
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
                haptic="none"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: space[2],
                  minHeight: 48,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: tokens.border.default
                }}
              >
                <Plus size={icon.size.xs} color={tokens.text.secondary} strokeWidth={icon.stroke.bold} />
                <Text variant="meta-strong">Add exercises</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* rest countdown — glass pill above the bottom bar */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: space[4], right: space[4], bottom: insets.bottom + 112 }}
      >
        <RestTimerPill signal={restSignal} onDone={() => setRestSignal(0)} />
      </View>

      <WorkoutLiveSummary
        totals={totals}
        primaryLabel={primaryLabel}
        primaryEmphasis={totals.done > 0}
        primaryDisabled={saving || (totals.done === 0 && !active && !editingId)}
        onPrimary={() => (totals.done > 0 ? void finish() : discard())}
      />

      {celebrating ? <PrCelebration text={celebrating.text} confKey={confKey} /> : null}
    </View>
  );
}
