/**
 * Strength trophies (Bench / Squat / Deadlift / Pull-ups / Push-ups) are
 * VIDEO-VERIFIED — they never auto-earn from a check-in. A max-lift video has
 * to be reviewed before the tier counts, so the trophy case shows the
 * requirement with no progress bar.
 *
 * `verifyLift` is the placeholder the max-lift verification pipeline will
 * replace. For now it always reports "pending-review" so nothing unlocks a
 * strength tier by accident. When verification ships, it returns accepted with
 * the confirmed value, which the trophy engine feeds into the strength stat.
 */

export type LiftKind = "bench" | "squat" | "deadlift" | "pullups" | "pushups";

export const STRENGTH_TROPHY_IDS: LiftKind[] = ["bench", "squat", "deadlift", "pullups", "pushups"];

export function isStrengthTrophy(id: string): id is LiftKind {
  return (STRENGTH_TROPHY_IDS as string[]).includes(id);
}

export type VerifyLiftInput = {
  exercise: LiftKind;
  value: number;
  unit: "lb" | "reps";
  mediaId: string;
  performedAt: string;
};

export type VerifyLiftResult = {
  accepted: boolean;
  /** Best-ever stat key this lift would bump on acceptance (e.g. "benchMax"). */
  statKey: string;
  value: number;
  status: "pending-review" | "verified" | "rejected";
  reason?: string;
};

/** Stat key a lift kind writes to (bench→benchMax, pullups→pullupMax, …). */
export function strengthStatKey(exercise: LiftKind): string {
  if (exercise === "pullups") return "pullupMax";
  if (exercise === "pushups") return "pushupMax";
  return `${exercise}Max`;
}

/**
 * Placeholder verifier. The real implementation POSTs the max-lift video to the
 * review pipeline and returns accepted once approved. Kept pending so strength
 * tiers stay locked until real verification exists.
 */
export function verifyLift(input: VerifyLiftInput): VerifyLiftResult {
  return {
    accepted: false,
    statKey: strengthStatKey(input.exercise),
    value: input.value,
    status: "pending-review"
  };
}
