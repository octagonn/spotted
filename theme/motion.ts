import { Easing } from "react-native-reanimated";

/**
 * Motion tokens from design/REDESIGN-SPEC.md §1.3 + §10.
 * Bezier arrays are exported raw so they can be fed to non-Reanimated APIs
 * (e.g. CSS transitions on web, react-navigation configs).
 */

/** cubic-bezier(0.32, 0.08, 0.24, 1) — presses, small UI */
export const easeStandard = [0.32, 0.08, 0.24, 1] as const;
/** cubic-bezier(0.2, 0, 0, 1) — screen/panel/sheet transitions */
export const easeEmphasized = [0.2, 0, 0, 1] as const;
/** cubic-bezier(0.4, 0, 1, 1) — exits (declared in spec, unused in mockup) */
export const easeExit = [0.4, 0, 1, 1] as const;

/** Reanimated Easing functions built from the spec beziers. */
export const easing = {
  standard: Easing.bezier(easeStandard[0], easeStandard[1], easeStandard[2], easeStandard[3]),
  emphasized: Easing.bezier(easeEmphasized[0], easeEmphasized[1], easeEmphasized[2], easeEmphasized[3]),
  exit: Easing.bezier(easeExit[0], easeExit[1], easeExit[2], easeExit[3]),
  linear: Easing.linear
} as const;

/** Durations (ms) from the spec's animation inventory (§10). */
export const durations = {
  /** Press feedback: scale 0.965 + opacity 0.85 */
  press: 140,
  /** Segmented control / rel-button / tab icon color transitions */
  color: 180,
  /** Toast fade + 16px rise */
  toast: 220,
  /** Toast dwell before auto-hide */
  toastDwell: 2100,
  /** Sheet backdrop fade */
  backdrop: 240,
  /** Tab switch: opacity + scale 1.015→1 */
  tab: 280,
  /** Panel push: translateX 100%→0 */
  panel: 300,
  /** Panel pop cleanup */
  panelPop: 320,
  /** Sheet translateY 105%→0; comments expand */
  sheet: 320,
  /** Camera open/close translateY */
  camera: 340,
  /** Challenge progress bar width */
  challengeBar: 400,
  /** White flash ramp-in (linear); fully off ~150ms */
  flashIn: 90,
  flashTotal: 150,
  /** Ambient pulse (live dot, breathing rings) — one half-cycle */
  pulse: 800,
  /** Celebration overlays (PR flash fade, count-ups) */
  celebration: 1000
} as const;

/**
 * Shared spring presets (Reanimated `withSpring` configs). Pick by feel, not
 * by tuning numbers per screen:
 * - snappy   press/selection feedback, small toggles
 * - gentle   panels, sheets, cards settling into place
 * - bouncy   celebratory moments only (PR, post published)
 */
export const springs = {
  snappy: { damping: 18, stiffness: 280, mass: 1 },
  gentle: { damping: 22, stiffness: 180, mass: 1 },
  bouncy: { damping: 12, stiffness: 220, mass: 1 }
} as const;

/** Legacy shape kept for existing imports. */
export const motion = {
  duration: {
    instant: 120,
    fast: 220,
    base: 320,
    slow: 480
  },
  easing: {
    standard: easing.standard,
    emphasized: easing.emphasized,
    exit: easing.exit
  }
} as const;
