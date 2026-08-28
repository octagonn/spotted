import * as Haptics from "expo-haptics";

export async function selectionHaptic() {
  await Haptics.selectionAsync();
}

export async function impactHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  await Haptics.impactAsync(style);
}

export async function successHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function warningHaptic() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/* ------------------------------ sequences ------------------------------ */

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Never let a haptic failure (simulator, unsupported device) break a flow. */
const tap = (style: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(style).catch(() => {});
const notify = (type: Haptics.NotificationFeedbackType) => Haptics.notificationAsync(type).catch(() => {});

/**
 * Workout-finished celebration: a rising three-tap roll, the system success
 * chime, then a heavy landing thump — timed to land with the confetti and the
 * volume count-up on the summary screen.
 *
 * Every PR earned adds a crisp extra beat (capped at 3) and a closing
 * flourish, so a record-breaking session physically feels bigger than an
 * ordinary one.
 */
export async function workoutFinishedHaptics(prCount = 0): Promise<void> {
  // Build-up: light, light, medium.
  await tap(Haptics.ImpactFeedbackStyle.Light);
  await wait(90);
  await tap(Haptics.ImpactFeedbackStyle.Light);
  await wait(90);
  await tap(Haptics.ImpactFeedbackStyle.Medium);

  // The moment it lands.
  await wait(130);
  await notify(Haptics.NotificationFeedbackType.Success);
  await wait(150);
  await tap(Haptics.ImpactFeedbackStyle.Heavy);

  // One crisp beat per PR, then a closing thump.
  const beats = Math.min(prCount, 3);
  for (let i = 0; i < beats; i += 1) {
    await wait(150);
    await tap(Haptics.ImpactFeedbackStyle.Rigid);
  }
  if (beats > 0) {
    await wait(180);
    await tap(Haptics.ImpactFeedbackStyle.Heavy);
  }
}
