import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { create } from "zustand";

import { logger } from "@/lib/logger";

/** AsyncStorage key holding the local-date string of the last daily post. */
const POSTED_TODAY_KEY = "spotted:postedTodayDate";

import { localDateKey } from "@/lib/dateKey";

/** Re-exported for existing importers; the implementation lives in lib (node-testable). */
export { localDateKey };

export type ToastItem = { id: number; message: string };

type UiState = {
  /** FIFO toast queue — ToastHost displays toasts[0] and dismisses it after the dwell. */
  toasts: ToastItem[];
  show: (message: string) => void;
  dismissToast: (id: number) => void;

  /** Incrementing signal — FlashOverlay plays the white flash whenever this changes. */
  flashSignal: number;
  flash: () => void;

  /** Incrementing signal — PostCelebration plays the publish burst whenever this changes. */
  celebrationSignal: number;
  celebrate: () => void;

  /** Local date key ("YYYY-MM-DD") of the last published daily post, or null. */
  postedDate: string | null;
  postedHydrated: boolean;
  markPostedToday: () => void;
  /** Dev/testing helper — clears the posted-today flag. */
  clearPostedToday: () => void;

  /** Per-session sets (reset on app restart) for one-shot interactions. */
  spottedIds: Set<string>;
  markSpotted: (id: string) => void;
  wavedIds: Set<string>;
  markWaved: (id: string) => void;
  /** post id → captured selfie URI (null when capture failed/unavailable). */
  reactedSelfies: Record<string, string | null>;
  markReacted: (id: string, selfieUri: string | null) => void;

  /** Wipe all per-account UI state (posted flag + one-shot sets) on sign-out/switch. */
  resetForAccount: () => void;
};

let nextToastId = 1;

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  show: (message) => set((state) => ({ toasts: [...state.toasts, { id: nextToastId++, message }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  flashSignal: 0,
  flash: () => set((state) => ({ flashSignal: state.flashSignal + 1 })),

  celebrationSignal: 0,
  celebrate: () => set((state) => ({ celebrationSignal: state.celebrationSignal + 1 })),

  postedDate: null,
  postedHydrated: false,
  markPostedToday: () => {
    const key = localDateKey();
    set({ postedDate: key });
    AsyncStorage.setItem(POSTED_TODAY_KEY, key).catch((error) => {
      logger.warn(`ui-store: Failed to persist posted-today flag (${String(error)})`);
    });
  },
  clearPostedToday: () => {
    set({ postedDate: null });
    AsyncStorage.removeItem(POSTED_TODAY_KEY).catch((error) => {
      logger.warn(`ui-store: Failed to clear posted-today flag (${String(error)})`);
    });
  },

  spottedIds: new Set<string>(),
  markSpotted: (id) => set((state) => ({ spottedIds: new Set(state.spottedIds).add(id) })),
  wavedIds: new Set<string>(),
  markWaved: (id) => set((state) => ({ wavedIds: new Set(state.wavedIds).add(id) })),
  reactedSelfies: {},
  markReacted: (id, selfieUri) => set((state) => ({ reactedSelfies: { ...state.reactedSelfies, [id]: selfieUri } })),

  resetForAccount: () => {
    // The posted-today flag persists in AsyncStorage under one global key — it
    // MUST be cleared on account switch or a new account inherits it (feed
    // unlocked without posting).
    set({
      postedDate: null,
      spottedIds: new Set<string>(),
      wavedIds: new Set<string>(),
      reactedSelfies: {}
    });
    AsyncStorage.removeItem(POSTED_TODAY_KEY).catch((error) => {
      logger.warn(`ui-store: Failed to clear posted-today flag (${String(error)})`);
    });
  }
}));

/** Hydrate the persisted posted-today flag once at module load. */
AsyncStorage.getItem(POSTED_TODAY_KEY)
  .then((stored) => {
    useUiStore.setState({ postedDate: stored ?? null, postedHydrated: true });
  })
  .catch((error) => {
    logger.warn(`ui-store: Failed to hydrate posted-today flag (${String(error)})`);
    useUiStore.setState({ postedHydrated: true });
  });

/** Milliseconds until the next local midnight (+1s of slack). */
function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * True when today's daily has been posted. Automatically flips back to false
 * at local midnight (business rule §11.1) without requiring a store write.
 */
export function usePostedToday(): boolean {
  const postedDate = useUiStore((state) => state.postedDate);
  const [today, setToday] = useState(() => localDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setToday(localDateKey());
        schedule();
      }, msUntilLocalMidnight());
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return postedDate === today;
}

/**
 * True when the last daily post is within the past `days` days (inclusive of
 * today). Drives the feed lock: e.g. `usePostedWithinDays(7)` keeps the feed
 * open for a week after the last post. Recomputes at local midnight.
 */
export function usePostedWithinDays(days: number): boolean {
  const postedDate = useUiStore((state) => state.postedDate);
  const [todayKey, setTodayKey] = useState(() => localDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setTodayKey(localDateKey());
        schedule();
      }, msUntilLocalMidnight());
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  if (!postedDate) {
    return false;
  }
  const posted = new Date(`${postedDate}T00:00:00`).getTime();
  const today = new Date(`${todayKey}T00:00:00`).getTime();
  const diffDays = Math.round((today - posted) / 86_400_000);
  return diffDays >= 0 && diffDays < days;
}

/** Imperative helpers for non-component code. */
export function markPostedToday(): void {
  useUiStore.getState().markPostedToday();
}

export function showToast(message: string): void {
  useUiStore.getState().show(message);
}

export function triggerFlash(): void {
  useUiStore.getState().flash();
}

/** Publish burst (confetti + stamp + haptic salvo) — fire right after posting. */
export function triggerPostCelebration(): void {
  useUiStore.getState().celebrate();
}
